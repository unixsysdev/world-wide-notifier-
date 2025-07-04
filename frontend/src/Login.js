import React, { useState } from 'react';
import { useAuth } from './AuthContext';

const Login = () => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '55007373246-ccgp802kv46a4tml23jqqddfbbheva77.apps.googleusercontent.com';

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Load Google Identity Services
      if (!window.google) {
        throw new Error('Google Identity Services not loaded');
      }

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

      window.google.accounts.id.prompt();
    } catch (error) {
      console.error('Google login error:', error);
      setError('Google login not available. Please try again.');
      setIsLoading(false);
    }
  };

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

  React.useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      setTimeout(handleGoogleSignInClick, 100);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to AI Monitoring
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Monitor your sources with AI-powered alerts
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
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
          

        </div>
      </div>
    </div>
  );
};

export default Login;
