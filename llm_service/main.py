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
            
            # Extract JSON from response - handle markdown code blocks
            # Updated regex to handle both JSON objects and arrays
            json_block_match = re.search(r'```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```', response_text, re.DOTALL)
            if json_block_match:
                json_text = json_block_match.group(1)
            else:
                # Fallback to finding any JSON object or array
                json_match = re.search(r'(\{.*\}|\[.*\])', response_text, re.DOTALL)
                json_text = json_match.group() if json_match else None
            
            if json_text:
                try:
                    analysis_data = json.loads(json_text)
                    # Handle both single object and array responses
                    if isinstance(analysis_data, list) and len(analysis_data) > 0:
                        analysis_data = analysis_data[0]  # Take the first item if it's an array
                    score = analysis_data.get('relevance_score', 0)
                    print(f"Analysis score: {score}")
                    
                    return AnalysisResponse(
                        relevance_score=score,
                        title=analysis_data.get('title', 'Analysis Result'),
                        summary=analysis_data.get('summary', 'Content analyzed'),
                        key_points=analysis_data.get('key_points', ['Analysis completed']),
                        confidence=analysis_data.get('confidence', 0.5),
                        success=True
                    )
                except json.JSONDecodeError as e:
                    print(f"JSON parsing error: {e}")
                    print(f"Raw JSON text: {json_text[:200]}...")
                    return AnalysisResponse(
                        relevance_score=0,
                        title="JSON Parsing Error",
                        summary=f"Error parsing LLM response: {str(e)}",
                        key_points=["JSON parsing failed"],
                        confidence=0.0,
                        success=False,
                        error=f"JSON parsing failed: {str(e)}"
                    )
                except Exception as e:
                    print(f"Analysis data processing error: {e}")
                    return AnalysisResponse(
                        relevance_score=0,
                        title="Analysis Processing Error",
                        summary=f"Error processing analysis data: {str(e)}",
                        key_points=["Analysis processing failed"],
                        confidence=0.0,
                        success=False,
                        error=f"Analysis processing failed: {str(e)}"
                    )
            else:
                print("No JSON found in response")
                print(f"Raw response: {response_text[:500]}...")
                return AnalysisResponse(
                    relevance_score=0,
                    title="Parsing Error",
                    summary="Could not parse LLM response - no JSON found",
                    key_points=["JSON parsing failed"],
                    confidence=0.0,
                    success=False,
                    error="JSON parsing failed - no JSON found in response"
                )
        else:
            print(f"OpenRouter API error: {response.status_code}")
            return AnalysisResponse(
                relevance_score=0,
                title="API Error",
                summary=f"OpenRouter API error: {response.status_code}",
                key_points=["API failed"],
                confidence=0.0,
                success=False,
                error=f"API error: {response.status_code}"
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
