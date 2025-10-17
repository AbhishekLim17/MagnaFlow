import React, { useState } from "react";
import { motion } from "framer-motion";
import { LogIn, User, Lock, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    console.log("🚀 LOGIN FORM SUBMITTED");
    console.log("📧 Form email state:", `"${email}"`);
    console.log("🔑 Form password state:", `"${password}"`);
    console.log("📏 Form email length:", email?.length);
    console.log("📏 Form password length:", password?.length);
    console.log("🌐 User Agent:", navigator.userAgent);
    console.log(
      "🌐 Browser localStorage support:",
      typeof Storage !== "undefined"
    );

    try {
      const result = login(email, password);
      console.log("🎯 Login result:", result);

      if (result.success) {
        console.log("✅ Login successful, showing success toast");
        toast({
          title: "Welcome back!",
          description: `Logged in as ${result.user.role}`,
        });
      } else {
        console.log("❌ Login failed, showing error toast");
        toast({
          title: "Login failed",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("💥 Exception during login:", error);
      toast({
        title: "Login failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const demoCredentials = [
    { role: "Admin", email: "admin@projectflow.com", password: "admin123" },
    { role: "Staff", email: "staff@projectflow.com", password: "staff123" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-float"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="glass-effect p-8 shadow-2xl">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4"
            >
              <Briefcase className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-bold gradient-text mb-2">
              ProjectFlow
            </h1>
            <p className="text-gray-300">Advanced Project Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-200">
                Email
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 glass-effect border-white/20 text-white placeholder-gray-400"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-200">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 glass-effect border-white/20 text-white placeholder-gray-400"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all duration-300 transform hover:scale-105"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-sm text-gray-300 mb-4 text-center">
              Demo Credentials:
            </p>
            <div className="space-y-3">
              {demoCredentials.map((cred, index) => (
                <motion.div
                  key={cred.role}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                  className="glass-effect p-3 rounded-lg cursor-pointer hover:bg-white/20 transition-all duration-200"
                  onClick={() => {
                    console.log("🎯 Demo credentials clicked:", cred);
                    console.log("📧 Setting email to:", `"${cred.email}"`);
                    console.log(
                      "🔑 Setting password to:",
                      `"${cred.password}"`
                    );
                    setEmail(cred.email);
                    setPassword(cred.password);
                    console.log("✅ Form state updated");
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-300">
                      {cred.role}
                    </span>
                    <span className="text-xs text-gray-400">Click to use</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{cred.email}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;
