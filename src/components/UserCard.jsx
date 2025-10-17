import React from 'react';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { Mail, Phone, Calendar, User, Building, Award, TrendingUp } from 'lucide-react';

// Tier definitions with colors and levels
const TIERS = {
  'Intern': { level: 1, color: 'bg-gray-500', description: 'Learning and Training' },
  'Junior': { level: 2, color: 'bg-blue-500', description: 'Early Career Professional' },
  'Mid-Level': { level: 3, color: 'bg-green-500', description: 'Experienced Professional' },
  'Senior': { level: 4, color: 'bg-purple-500', description: 'Subject Matter Expert' },
  'Lead': { level: 5, color: 'bg-orange-500', description: 'Team Leadership' },
  'Principal': { level: 6, color: 'bg-red-500', description: 'Strategic Leadership' }
};

// Role badge colors for dark theme
const ROLE_COLORS = {
  admin: 'bg-red-500/20 text-red-300 border-red-400/30',
  manager: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  staff: 'bg-green-500/20 text-green-300 border-green-400/30'
};

const UserCard = ({ userData, showActions = false, onEdit, compact = false }) => {
  const tierInfo = TIERS[userData.tier] || TIERS['Junior'];
  const roleColor = ROLE_COLORS[userData.role] || ROLE_COLORS['staff'];

  const formatDate = (date) => {
    if (!date) return 'Not specified';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString();
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-3 p-3 border border-white/20 rounded-lg hover:bg-white/5 glass-effect">
        <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
          <span className="text-white font-medium text-sm">
            {userData.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{userData.name}</p>
            <Badge className={`text-xs ${roleColor}`}>
              {userData.role}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 truncate">{userData.designation}</p>
        </div>
        <div className="flex flex-col items-end">
          <Badge 
            className={`text-xs text-white ${tierInfo.color}`}
          >
            {userData.tier}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <Card className="glass-effect hover:bg-white/10 transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {userData.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
              </span>
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-white">{userData.name}</h3>
              <div className="flex items-center gap-2">
                <Badge className={`${roleColor}`}>
                  {userData.role.toUpperCase()}
                </Badge>
                <Badge 
                  className={`text-white ${tierInfo.color}`}
                >
                  {userData.tier}
                </Badge>
              </div>
            </div>
          </div>
          {showActions && onEdit && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(userData);
              }}
              className="px-3 py-1 text-sm text-blue-300 hover:text-blue-200 border border-blue-400/30 rounded hover:bg-blue-500/20 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Designation */}
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Award className="h-4 w-4" />
              <span className="font-medium">Designation:</span>
              <span>{userData.designation || 'Not specified'}</span>
            </div>

            {/* Department */}
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Building className="h-4 w-4" />
              <span className="font-medium">Department:</span>
              <span>{userData.department || 'Not specified'}</span>
            </div>

            {/* Employee ID */}
            {userData.employeeId && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <User className="h-4 w-4" />
                <span className="font-medium">Employee ID:</span>
                <span>{userData.employeeId}</span>
              </div>
            )}

            {/* Email */}
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Mail className="h-4 w-4" />
              <span className="font-medium">Email:</span>
              <span className="truncate">{userData.email}</span>
            </div>

            {/* Phone */}
            {userData.phone && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Phone className="h-4 w-4" />
                <span className="font-medium">Phone:</span>
                <span>{userData.phone}</span>
              </div>
            )}

            {/* Joining Date */}
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Joined:</span>
              <span>{formatDate(userData.joiningDate)}</span>
            </div>
          </div>

          {/* Tier Description */}
          <div className="flex items-center space-x-2 text-sm text-gray-300 pt-2 border-t border-white/20">
            <TrendingUp className="h-4 w-4" />
            <span className="font-medium">Level:</span>
            <span>{tierInfo.description}</span>
          </div>

          {/* Reporting To */}
          {userData.reportingTo && (
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <User className="h-4 w-4" />
              <span className="font-medium">Reports to:</span>
              <span>{userData.reportingTo}</span>
            </div>
          )}
        </div>

        {/* Status */}
        <div className="mt-4 pt-3 border-t border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${userData.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className={`text-sm ${userData.isActive ? 'text-green-400' : 'text-gray-400'}`}>
                {userData.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            {userData.createdAt && (
              <span className="text-xs text-gray-400">
                Added {formatDate(userData.createdAt)}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserCard;