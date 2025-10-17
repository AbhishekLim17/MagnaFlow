import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  BarChart3, 
  TrendingUp, 
  Calendar,
  Award,
  AlertCircle,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const PrincipalDashboard = () => {
  const { user } = useAuth();
  const { 
    currentCompany, 
    getCompanyEmployees, 
    getCompanyPerformanceReports,
    updateCompanyStats 
  } = useCompany();
  
  const [employees, setEmployees] = useState([]);
  const [performanceReports, setPerformanceReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeProjects: 0,
    completedProjects: 0,
    avgPerformance: 0,
    monthlyGrowth: 0
  });

  // Fetch company data
  const fetchCompanyData = async () => {
    if (!currentCompany) return;

    setLoading(true);
    try {
      // Fetch employees
      const employeesData = await getCompanyEmployees(currentCompany.id);
      setEmployees(employeesData);

      // Fetch performance reports
      const reportsData = await getCompanyPerformanceReports(currentCompany.id);
      setPerformanceReports(reportsData);

      // Calculate statistics
      const totalEmployees = employeesData.length;
      const activeProjects = reportsData.filter(r => r.status === 'active').length;
      const completedProjects = reportsData.filter(r => r.status === 'completed').length;
      const avgPerformance = reportsData.length > 0 
        ? reportsData.reduce((sum, r) => sum + (r.score || 0), 0) / reportsData.length 
        : 0;

      setStats({
        totalEmployees,
        activeProjects,
        completedProjects,
        avgPerformance: Math.round(avgPerformance * 10) / 10,
        monthlyGrowth: Math.floor(Math.random() * 15) + 5 // Mock data
      });

      // Update company stats in database
      await updateCompanyStats(currentCompany.id);

    } catch (error) {
      console.error('Error fetching company data:', error);
      toast.error('Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentCompany) {
      fetchCompanyData();
    }
  }, [currentCompany]);

  // Group employees by tier
  const employeesByTier = employees.reduce((acc, employee) => {
    const tier = employee.tier || 'Unassigned';
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(employee);
    return acc;
  }, {});

  // Recent performance reports (last 5)
  const recentReports = performanceReports
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Company Assigned</h2>
          <p className="text-gray-600">
            You haven't been assigned as a company owner yet. 
            Please contact the Alpha (portal owner) to assign you to a company.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Company Owner Dashboard</h1>
          <p className="text-gray-600 mt-1">Managing {currentCompany.name}</p>
        </div>
        <Card className="p-4">
          <div className="text-center">
            <Building2 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-gray-900">{currentCompany.name}</p>
            <p className="text-sm text-gray-600">{currentCompany.industry}</p>
            <Badge variant="default" className="mt-2">Owner</Badge>
          </div>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalEmployees}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-3xl font-bold text-orange-600">{stats.activeProjects}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed Projects</p>
                <p className="text-3xl font-bold text-green-600">{stats.completedProjects}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Performance</p>
                <p className="text-3xl font-bold text-purple-600">{stats.avgPerformance}/10</p>
              </div>
              <Award className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Growth</p>
                <p className="text-3xl font-bold text-teal-600">+{stats.monthlyGrowth}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-teal-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Company Name</p>
                    <p className="text-gray-900">{currentCompany.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Industry</p>
                    <p className="text-gray-900">{currentCompany.industry || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Email</p>
                    <p className="text-gray-900">{currentCompany.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Phone</p>
                    <p className="text-gray-900">{currentCompany.phone}</p>
                  </div>
                </div>
                {currentCompany.address && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Address</p>
                    <p className="text-gray-900">{currentCompany.address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employee Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Employee Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(employeesByTier).map(([tier, tierEmployees]) => (
                    <div key={tier} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tier}</Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{tierEmployees.length}</p>
                        <p className="text-xs text-gray-500">
                          {((tierEmployees.length / stats.totalEmployees) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Recent Performance Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No performance reports available</p>
              ) : (
                <div className="space-y-3">
                  {recentReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{report.employeeName || 'Unknown Employee'}</p>
                        <p className="text-sm text-gray-600">{report.title || 'Performance Review'}</p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={report.status === 'completed' ? 'default' : 'secondary'}
                        >
                          {report.status}
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Company Employees</CardTitle>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No employees found</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map((employee) => (
                    <Card key={employee.id} className="border hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-gray-900">{employee.name}</h3>
                            <Badge variant="outline">{employee.tier}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{employee.email}</p>
                          <p className="text-sm text-gray-600">{employee.department}</p>
                          <p className="text-sm text-gray-600">{employee.designation}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Performance analytics coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>All Performance Reports</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceReports.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No performance reports available</p>
              ) : (
                <div className="space-y-4">
                  {performanceReports.map((report) => (
                    <div key={report.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">
                          {report.title || 'Performance Review'}
                        </h4>
                        <Badge variant={report.status === 'completed' ? 'default' : 'secondary'}>
                          {report.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Employee</p>
                          <p className="font-medium">{report.employeeName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Score</p>
                          <p className="font-medium">{report.score || 'N/A'}/10</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Date</p>
                          <p className="font-medium">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Period</p>
                          <p className="font-medium">{report.period || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PrincipalDashboard;