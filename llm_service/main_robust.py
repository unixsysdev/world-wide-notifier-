from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
import requests
import os
import json
import re
from bs4 import BeautifulSoup

app = FastAPI(title="LLM Analysis Service")

# Internal API authentication
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "internal-service-key-change-in-production")

def verify_internal_api_key(request: Request):
    """Verify internal API key for service-to-service communication"""
    api_key = request.headers.get("X-Internal-API-Key")
    if not api_key or api_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    return True

class AnalysisRequest(BaseModel):
    content: str
    prompt: str
    max_tokens: int = 1000
    model: str = "google/gemini-2.0-flash-001"

class AnalysisResponse(BaseModel):
    relevance_score: int
    title: str
    summary: str
    key_points: list
    confidence: float
    success: bool
    error: str = None

def clean_html_content(html_content):
    """Better HTML cleaning to extract actual article content"""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(["script", "style", "nav", "header", "footer", "aside", "form", "button"]):
            element.decompose()
        
        # Try to find main content areas
        main_content = ""
        
        # Look for article content in common containers
        content_selectors = [
            'article', 'main', '.post-content', '.entry-content', 
            '.article-content', '.content', 'h1', 'h2', 'h3', 'p'
        ]
        
        for selector in content_selectors:
            elements = soup.select(selector)
            for element in elements:
                text = element.get_text().strip()
                if len(text) > 50:  # Only include substantial text
                    main_content += text + " "
        
        # If no specific content found, get all text
        if len(main_content) < 100:
            main_content = soup.get_text()
        
        # Clean up whitespace
        lines = (line.strip() for line in main_content.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Limit text length but keep meaningful content
        if len(text) > 8000:
            # Try to keep complete sentences
            text = text[:8000]
            last_period = text.rfind('.')
            if last_period > 4000:  # If we have a good amount of text
                text = text[:last_period + 1]
            text += "..."
        
        print(f"Cleaned content preview: {text[:200]}...")
        return text
        
    except Exception as e:
        print(f"HTML cleaning error: {e}")
        return html_content[:8000]

def robust_json_parse(response_text):
    """Robust JSON parsing with multiple fallback strategies"""
    
    def clean_json_text(text):
        """Clean and repair common JSON issues"""
        # Remove leading/trailing whitespace
        text = text.strip()
        
        # Remove trailing commas before closing braces/brackets
        text = re.sub(r',(\s*[}\]])', r'\1', text)
        
        # Fix unquoted keys (but be careful with already quoted ones)
        # This regex looks for word characters followed by : that aren't already quoted
        text = re.sub(r'(?<!")(\b\w+)(?=\s*:)', r'"\1"', text)
        
        # Fix double-quoted keys that got over-quoted
        text = re.sub(r'""(\w+)""', r'"\1"', text)
        
        return text
    
    def extract_with_regex(text):
        """Extract key fields using regex as last resort"""
        try:
            # Try to extract the main fields we need
            score_match = re.search(r'"?relevance_score"?\s*:\s*(\d+)', text)
            title_match = re.search(r'"?title"?\s*:\s*"([^"]*)"', text)
            summary_match = re.search(r'"?summary"?\s*:\s*"([^"]*)"', text)
            confidence_match = re.search(r'"?confidence"?\s*:\s*([0-9.]+)', text)
            
            # Extract key points array
            key_points = []
            key_points_match = re.search(r'"?key_points"?\s*:\s*\[(.*?)\]', text, re.DOTALL)
            if key_points_match:
                points_text = key_points_match.group(1)
                # Extract individual quoted strings
                points = re.findall(r'"([^"]*)"', points_text)
                key_points = points[:5]  # Limit to 5 points
            
            if score_match:
                return {
                    "relevance_score": min(100, max(0, int(score_match.group(1)))),
                    "title": title_match.group(1) if title_match else "Analysis Result",
                    "summary": summary_match.group(1) if summary_match else "Content analyzed via fallback parsing",
                    "key_points": key_points if key_points else ["Analysis completed with fallback parsing"],
                    "confidence": min(1.0, max(0.0, float(confidence_match.group(1)))) if confidence_match else 0.3
                }
        except Exception as e:
            print(f"Regex extraction failed: {e}")
        
        return None
    
    # Strategy 1: Look for JSON in code blocks
    patterns = [
        r'```(?:json)?\s*(\{.*?\})\s*```',  # JSON in code blocks
        r'```(?:json)?\s*(\[.*?\])\s*```',  # Array in code blocks
        r'(\{[^{}]*"relevance_score"[^{}]*\})',  # Look for objects with relevance_score
        r'(\{.*?\})',  # Any JSON object
        r'(\[.*?\])'   # Any JSON array
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, response_text, re.DOTALL)
        for match in matches:
            json_candidate = match.group(1)
            
            # Try parsing as-is first
            try:
                data = json.loads(json_candidate)
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                if isinstance(data, dict) and 'relevance_score' in data:
                    return data
            except json.JSONDecodeError:
                pass
            
            # Try cleaning and parsing
            try:
                cleaned = clean_json_text(json_candidate)
                data = json.loads(cleaned)
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                if isinstance(data, dict):
                    return data
            except json.JSONDecodeError:
                continue
    
    # Last resort: regex extraction
    return extract_with_regex(response_text)

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_content(analysis_request: AnalysisRequest, request: Request):
    # Verify internal API key
    verify_internal_api_key(request)
    
    try:
        cleaned_content = clean_html_content(analysis_request.content)
        
        print(f"Content length after cleaning: {len(cleaned_content)}")
        
        if not cleaned_content.strip() or len(cleaned_content) < 50:
            return AnalysisResponse(
                relevance_score=0,
                title="No meaningful content found",
                summary="The content appears to be empty or contains no readable text.",
                key_points=["No meaningful content detected"],
                confidence=0.0,
                success=False,
                error="Insufficient content"
            )
        
        prompt = f"""Analyze this content for relevance to the user's specific monitoring requirements.

Content: {cleaned_content}

User's Monitoring Requirements: {analysis_request.prompt}

Instructions:
1. Carefully evaluate if the content matches what the user is specifically looking for
2. Score based on how well the content aligns with the user's requirements (0-100)
3. Be precise - only score highly if the content genuinely matches their criteria
4. Consider context, keywords, topics, and overall relevance to their needs

Respond with JSON:
{{"relevance_score": 0-100, "title": "descriptive title", "summary": "brief summary", "key_points": ["point1", "point2"], "confidence": 0.0-1.0}}

Scoring Guidelines:
- 90-100: Perfect match for user requirements
- 70-89: Good match with most criteria met
- 50-69: Partial match, some relevance
- 30-49: Minimal relevance
- 0-29: No relevance or off-topic"""
        
        # Call OpenRouter API
        headers = {
            "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": analysis_request.model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": analysis_request.max_tokens,
            "temperature": 0.3
        }
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            response_text = result['choices'][0]['message']['content']
            
            print(f"LLM response: {response_text[:200]}...")
            
            # Use robust JSON parsing
            analysis_data = robust_json_parse(response_text)
            
            if analysis_data:
                try:
                    # Validate and sanitize the data
                    score = analysis_data.get('relevance_score', 0)
                    if not isinstance(score, (int, float)):
                        score = 0
                    score = max(0, min(100, int(score)))  # Clamp between 0-100
                    
                    title = str(analysis_data.get('title', 'Analysis Result'))[:200]
                    summary = str(analysis_data.get('summary', 'Content analyzed'))[:1000]
                    
                    key_points = analysis_data.get('key_points', ['Analysis completed'])
                    if not isinstance(key_points, list):
                        key_points = ['Analysis completed']
                    key_points = [str(point)[:200] for point in key_points[:10]]  # Limit items and length
                    
                    confidence = analysis_data.get('confidence', 0.5)
                    if not isinstance(confidence, (int, float)):
                        confidence = 0.5
                    confidence = max(0.0, min(1.0, float(confidence)))
                    
                    print(f"Analysis score: {score}")
                    
                    return AnalysisResponse(
                        relevance_score=score,
                        title=title,
                        summary=summary,
                        key_points=key_points,
                        confidence=confidence,
                        success=True
                    )
                    
                except Exception as e:
                    print(f"Data validation error: {e}")
                    return AnalysisResponse(
                        relevance_score=0,
                        title="Data Validation Error",
                        summary=f"Error validating analysis data: {str(e)}",
                        key_points=["Data validation failed"],
                        confidence=0.0,
                        success=False,
                        error=f"Data validation failed: {str(e)}"
                    )
            else:
                print("No valid JSON found in response")
                print(f"Raw response: {response_text[:500]}...")
                return AnalysisResponse(
                    relevance_score=0,
                    title="Parsing Error",
                    summary="Could not parse LLM response - no valid JSON found",
                    key_points=["JSON parsing failed"],
                    confidence=0.0,
                    success=False,
                    error="JSON parsing failed - no valid JSON found in response"
                )
        else:
            print(f"OpenRouter API error: {response.status_code}")
            error_text = response.text if hasattr(response, 'text') else str(response.status_code)
            return AnalysisResponse(
                relevance_score=0,
                title="API Error",
                summary=f"OpenRouter API error: {response.status_code}",
                key_points=["API failed"],
                confidence=0.0,
                success=False,
                error=f"API error: {response.status_code} - {error_text}"
            )
        
    except Exception as e:
        print(f"Analysis error: {e}")
        return AnalysisResponse(
            relevance_score=0,
            title="Analysis Error",
            summary=f"Error: {str(e)}",
            key_points=["Error occurred"],
            confidence=0.0,
            success=False,
            error=str(e)
        )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "llm_service"}
