import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase-config';
import { useToast } from './ui/use-toast';

const SimpleLoginTester = () => {
  const [email, setEmail] = useState('abhishek@magnetar.in');
  const [password, setPassword] = useState('Abhishek@1');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const testLogin = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      console.log('🔐 Attempting direct Firebase login...');
      console.log('Email:', email);
      console.log('Auth instance:', auth);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      console.log('✅ Login successful:', userCredential);
      
      setResult({
        success: true,
        message: 'Login successful!',
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          emailVerified: userCredential.user.emailVerified
        }
      });
      
      toast({
        title: "Success",
        description: "Direct Firebase login successful!",
      });
      
    } catch (error) {
      console.error('❌ Login failed:', error);
      
      setResult({
        success: false,
        message: error.message,
        code: error.code
      });
      
      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 p-8">
      <div className="max-w-md mx-auto">
        <Card className="glass-effect p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold gradient-text mb-2">Simple Login Tester</h1>
            <p className="text-gray-300">Direct Firebase Authentication Test</p>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-gray-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder-gray-400"
              />
            </div>
          </div>

          <Button 
            onClick={testLogin} 
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Testing Login...' : 'Test Direct Login'}
          </Button>

          {result && (
            <div className={`mt-6 p-4 rounded-lg ${result.success ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
              <h3 className={`font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Success!' : 'Failed!'}
              </h3>
              <p className="text-gray-300 text-sm mt-1">{result.message}</p>
              {result.code && (
                <p className="text-gray-400 text-xs mt-1">Error Code: {result.code}</p>
              )}
              {result.user && (
                <div className="mt-2 text-sm text-gray-300">
                  <p>UID: {result.user.uid}</p>
                  <p>Email: {result.user.email}</p>
                  <p>Verified: {result.user.emailVerified ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-900/20 rounded-lg">
            <h4 className="text-white font-semibold mb-2">This test:</h4>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Bypasses all application logic</li>
              <li>• Tests Firebase Auth directly</li>
              <li>• Shows exact error messages</li>
              <li>• Helps identify auth vs app issues</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SimpleLoginTester;