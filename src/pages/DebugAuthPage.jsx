import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DebugAuthPage = () => {
  const clearAndReinitializeUsers = () => {
    // Clear all auth-related localStorage
    localStorage.removeItem("projectflow_users");
    localStorage.removeItem("projectflow_user");

    // Initialize with both users
    const defaultUsers = [
      {
        id: 1,
        email: "admin@projectflow.com",
        password: "admin123",
        role: "admin",
        name: "Admin User",
      },
      {
        id: 2,
        email: "staff@projectflow.com",
        password: "staff123",
        role: "staff",
        name: "Staff User",
      },
    ];

    localStorage.setItem("projectflow_users", JSON.stringify(defaultUsers));

    alert(
      "Users reinitialized! You can now login with:\nAdmin: admin@projectflow.com / admin123\nStaff: staff@projectflow.com / staff123"
    );
    window.location.reload();
  };

  const showCurrentUsers = () => {
    const users = JSON.parse(localStorage.getItem("projectflow_users") || "[]");
    console.log("Current users in localStorage:", users);
    alert("Current users: " + JSON.stringify(users, null, 2));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-8 flex items-center justify-center">
      <Card className="glass-effect p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Auth Debug Tools
        </h1>

        <div className="space-y-4">
          <Button
            onClick={showCurrentUsers}
            className="w-full"
            variant="outline"
          >
            Show Current Users
          </Button>

          <Button onClick={clearAndReinitializeUsers} className="w-full">
            Clear & Reinitialize Users
          </Button>

          <Button
            onClick={() => (window.location.href = "/login")}
            className="w-full"
            variant="secondary"
          >
            Go to Login
          </Button>
        </div>

        <div className="mt-6 text-sm text-gray-400">
          <p className="mb-2">Default Credentials:</p>
          <p>Admin: admin@projectflow.com / admin123</p>
          <p>Staff: staff@projectflow.com / staff123</p>
        </div>
      </Card>
    </div>
  );
};

export default DebugAuthPage;
