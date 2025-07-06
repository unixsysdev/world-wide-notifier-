import React, { useEffect, useRef } from 'react';

const LandingPage = ({ onShowLogin, isDarkMode, toggleDarkMode }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    // Three.js scene setup for animated background
    if (!mountRef.current) return;

    // Try to load Three.js dynamically, with graceful fallback
    const loadThreeJS = async () => {
      try {
        const THREE = await import('three');
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ 
        alpha: true, 
        antialias: false, // Disable antialiasing for better performance
        powerPreference: "low-power" // Use integrated graphics when available
      });
      
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0); // Transparent background
      mountRef.current.appendChild(renderer.domElement);

      // Create floating particles (reduced count for performance)
      const particlesGeometry = new THREE.BufferGeometry();
      const particlesCount = 80; // Reduced from 150
      const posArray = new Float32Array(particlesCount * 3);

      for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20;
      }

      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

      const particlesMaterial = new THREE.PointsMaterial({
        size: 0.03,
        color: '#3B82F6',
        transparent: true,
        opacity: 0.8,
      });

      const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particlesMesh);

      // Create floating geometric shapes (reduced count)
      const shapes = [];
      for (let i = 0; i < 5; i++) { // Reduced from 8
        const geometry = Math.random() > 0.5 
          ? new THREE.BoxGeometry(0.2, 0.2, 0.2)
          : new THREE.SphereGeometry(0.15, 8, 6);
        
        const material = new THREE.MeshBasicMaterial({
          color: i % 2 === 0 ? '#3B82F6' : '#8B5CF6',
          transparent: true,
          opacity: 0.6,
        });

        const shape = new THREE.Mesh(geometry, material);
        shape.position.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );
        shapes.push(shape);
        scene.add(shape);
      }

      camera.position.z = 5;

      // Animation loop with performance optimizations
      let lastTime = 0;
      let isScrolling = false;
      let scrollTimeout;
      const targetFPS = 30; // Reduce from 60fps to 30fps
      const frameInterval = 1000 / targetFPS;
      
      // Pause animation during scroll for better performance
      const handleScroll = () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 150);
      };
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      const animate = (currentTime) => {
        requestAnimationFrame(animate);
        
        // Skip animation during scroll
        if (isScrolling) return;
        
        // Throttle animation to 30fps for better performance
        if (currentTime - lastTime < frameInterval) return;
        lastTime = currentTime;

        // Rotate particles (slower)
        particlesMesh.rotation.x += 0.0005; // Reduced from 0.001
        particlesMesh.rotation.y += 0.001;  // Reduced from 0.002

        // Animate shapes (less intensive)
        shapes.forEach((shape, index) => {
          shape.rotation.x += 0.005 + index * 0.0005; // Reduced animation speed
          shape.rotation.y += 0.005 + index * 0.001;
          shape.position.y += Math.sin(Date.now() * 0.0005 + index) * 0.0005; // Slower movement
        });

        renderer.render(scene, camera);
      };

      animate(0);

      // Handle resize
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };

      window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
          window.removeEventListener('resize', handleResize);
          window.removeEventListener('scroll', handleScroll);
          if (mountRef.current && renderer.domElement) {
            mountRef.current.removeChild(renderer.domElement);
          }
          renderer.dispose();
        };
      } catch (err) {
        console.log('Three.js failed to load, using fallback background');
      }
    };

    loadThreeJS();
  }, []);

  const testimonials = [
    {
      name: "Sarah Mitchell",
      role: "Oil Trader at EnergyFlow Capital",
      content: "I monitor crude oil news 24/7 with AI Monitoring. The second geopolitical events break, I get instant alerts that help me make trading decisions worth millions. It's like having a team of analysts working around the clock.",
      impact: "Increased trading profits by 35%"
    },
    {
      name: "Ben Rodriguez", 
      role: "E-commerce Entrepreneur",
      content: "I track competitor pricing on Amazon for 50+ products. When prices drop, I get alerted instantly to adjust my pricing strategy. Last month alone, this saved me $12,000 in lost sales.",
      impact: "Saved $12,000+ monthly"
    },
    {
      name: "Dr. Maria Santos",
      role: "Government Policy Analyst", 
      content: "I monitor multiple RSS feeds for healthcare policy changes. AI Monitoring filters through hundreds of documents daily and only alerts me to the critical updates I need for my research.",
      impact: "70% faster policy tracking"
    },
    {
      name: "Carlos Fernandez",
      role: "Investment Portfolio Manager",
      content: "I watch for market-moving news across 15 different sectors. The AI analysis gives me relevance scores so I know which alerts require immediate attention for my $50M portfolio.",
      impact: "Managing $50M+ portfolio efficiently"
    }
  ];

  const useCases = [
    {
      title: "Financial Trading",
      description: "Monitor news, regulations, and market events that impact your trading decisions",
      icon: "📈",
      examples: ["Oil price movements", "Currency fluctuations", "Regulatory changes", "Earnings reports"]
    },
    {
      title: "E-commerce Pricing",
      description: "Track competitor prices and market trends to optimize your pricing strategy", 
      icon: "🛒",
      examples: ["Amazon price drops", "Competitor launches", "Seasonal trends", "Stock levels"]
    },
    {
      title: "Government & Policy",
      description: "Stay informed about policy changes, regulations, and government announcements",
      icon: "🏛️", 
      examples: ["Policy updates", "Regulatory filings", "Public consultations", "Legislative changes"]
    },
    {
      title: "Investment Research",
      description: "Monitor market news, company announcements, and economic indicators",
      icon: "💼",
      examples: ["SEC filings", "Merger announcements", "Economic data", "Industry reports"]
    },
    {
      title: "Supply Chain Monitoring",
      description: "Track shipping, logistics, and supply chain disruptions in real-time",
      icon: "🚢",
      examples: ["Port delays", "Weather events", "Transportation costs", "Supplier news"]
    },
    {
      title: "Crypto & DeFi",
      description: "Monitor protocol updates, governance proposals, and market movements",
      icon: "₿",
      examples: ["Protocol upgrades", "Governance votes", "Yield farming", "Token launches"]
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden dark:bg-gray-900">
      {/* Three.js Background */}
      <div ref={mountRef} className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />
      
      {/* Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50" style={{ zIndex: 2 }} />
      
      {/* Content */}
      <div className="relative" style={{ zIndex: 3 }}>
        {/* Header */}
        <nav className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AI Monitoring
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-gray-800/50 dark:hover:bg-gray-700/50 transition-colors backdrop-blur-sm"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
              <button
                onClick={onShowLogin}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Sign In
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="container mx-auto px-6 py-12 text-center">
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
            Monitor Everything<br />That Matters
          </h1>
          <p className="text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed">
            AI-powered monitoring that watches the web for you. Get instant alerts when important changes happen across any website, news source, or data feed. Make faster decisions with intelligent notifications.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={onShowLogin}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-2xl hover:shadow-purple-500/25 transform hover:scale-105"
            >
              Start Monitoring Free
            </button>
            <p className="text-sm text-gray-600">
              Free tier • 3 alerts hourly • No credit card required
            </p>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="container mx-auto px-6 py-12">
          <h2 className="text-4xl font-bold text-center mb-10 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Choose Your Plan
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Free</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">$0<span className="text-lg text-gray-600">/month</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  3 monitoring alerts maximum
                </li>
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  Hourly check frequency
                </li>
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  Email notifications
                </li>
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  Basic AI analysis
                </li>
              </ul>
              <button
                onClick={onShowLogin}
                className="w-full bg-gray-200 text-gray-800 py-3 rounded-full font-semibold hover:bg-gray-300 transition-colors duration-300"
              >
                Get Started Free
              </button>
            </div>

            {/* Premium Tier */}
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-gray-200 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Premium</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">$10<span className="text-lg text-gray-600">/month</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  10 monitoring jobs maximum
                </li>
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  10-minute minimum frequency
                </li>
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  Multiple notification channels
                </li>
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  Advanced AI analysis
                </li>
                <li className="flex items-center text-gray-700">
                  <span className="text-green-500 mr-3">✓</span>
                  Priority support
                </li>
              </ul>
              <button
                onClick={onShowLogin}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-full font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg"
              >
                Upgrade to Premium
              </button>
            </div>

            {/* Premium Plus Tier - Best Value */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-8 shadow-2xl border-2 border-purple-400 hover:shadow-purple-500/25 transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold">
                BEST VALUE
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Premium Plus</h3>
              <div className="text-4xl font-bold text-white mb-4">$15<span className="text-lg text-purple-200">/month</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-white">
                  <span className="text-yellow-300 mr-3">✓</span>
                  Unlimited monitoring jobs
                </li>
                <li className="flex items-center text-white">
                  <span className="text-yellow-300 mr-3">✓</span>
                  1-minute minimum frequency
                </li>
                <li className="flex items-center text-white">
                  <span className="text-yellow-300 mr-3">✓</span>
                  All notification channels
                </li>
                <li className="flex items-center text-white">
                  <span className="text-yellow-300 mr-3">✓</span>
                  Premium AI analysis
                </li>
                <li className="flex items-center text-white">
                  <span className="text-yellow-300 mr-3">✓</span>
                  24/7 priority support
                </li>
                <li className="flex items-center text-white">
                  <span className="text-yellow-300 mr-3">✓</span>
                  Custom integrations
                </li>
              </ul>
              <button
                onClick={onShowLogin}
                className="w-full bg-white text-purple-600 py-3 rounded-full font-bold hover:bg-gray-100 transition-colors duration-300 shadow-lg"
              >
                Go Premium Plus
              </button>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="container mx-auto px-6 py-12 bg-white/30 backdrop-blur-sm">
          <h2 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Powerful Use Cases
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {useCases.map((useCase, index) => (
              <div key={index} className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <div className="text-4xl mb-4">{useCase.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{useCase.title}</h3>
                <p className="text-gray-700 mb-4">{useCase.description}</p>
                <ul className="space-y-1">
                  {useCase.examples.map((example, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-center">
                      <span className="text-blue-500 mr-2">•</span>
                      {example}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="container mx-auto px-6 py-12">
          <h2 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Real Results from Real Users
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white/70 backdrop-blur-sm rounded-xl p-8 shadow-lg hover:shadow-xl transition-all duration-300">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 mb-4 italic">"{testimonial.content}"</p>
                    <div className="text-sm">
                      <div className="font-bold text-gray-900">{testimonial.name}</div>
                      <div className="text-gray-600">{testimonial.role}</div>
                      <div className="text-green-600 font-semibold mt-2">{testimonial.impact}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-12 text-center">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 text-white">
            <h2 className="text-4xl font-bold mb-4">Ready to Start Monitoring?</h2>
            <p className="text-xl mb-6 opacity-90">
              Join thousands of professionals who never miss important updates
            </p>
            <button
              onClick={onShowLogin}
              className="bg-white text-purple-600 px-8 py-4 rounded-full text-lg font-bold hover:bg-gray-100 transition-colors duration-300 shadow-lg transform hover:scale-105"
            >
              Get Started for Free
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="container mx-auto px-6 py-12 border-t border-gray-200">
          <div className="text-center text-gray-600">
            <p>&copy; 2025 AI Monitoring. Built for professionals who need to stay ahead.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;