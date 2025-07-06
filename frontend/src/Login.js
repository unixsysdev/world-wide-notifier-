import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import LandingPage from './LandingPage';

const Login = ({ isDarkMode, toggleDarkMode }) => {
  const { login } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '55007373246-ccgp802kv46a4tml23jqqddfbbheva77.apps.googleusercontent.com';

  // Load Google Identity Services script (must be at top level)
  React.useEffect(() => {
    if (showLogin) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        setTimeout(handleGoogleSignInClick, 100);
      };
      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, [showLogin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!showLogin) {
    return <LandingPage onShowLogin={() => setShowLogin(true)} />;
  }

  const handleGoogleSignInClick = () => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const result = await login(response.credential);
            if (!result.success) {
              setError(result.error);
            }
          } catch (error) {
            setError('Login failed. Please try again.');
          } finally {
            setIsLoading(false);
          }
        },
      });

      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-button'),
        {
          theme: 'outline',
          size: 'large',
          width: '100%',
        }
      );
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <button
            onClick={() => setShowLogin(false)}
            className="text-blue-600 hover:text-blue-800 text-sm mb-4 flex items-center mx-auto"
          >
            ← Back to home
          </button>
          <div className="flex items-center justify-center space-x-2 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">AI</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Monitoring
            </span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your monitoring dashboard
          </p>
        </div>
        
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          <div>
            <div id="google-signin-button" className="w-full"></div>
            
            {isLoading && (
              <div className="mt-4 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">Signing in...</p>
              </div>
            )}
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
