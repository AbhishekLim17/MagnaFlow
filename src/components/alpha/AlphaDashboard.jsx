import React, { useState, useEffect } from 'react';
import { Plus, Building2, Users, Settings, BarChart3, Eye, Edit, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase-config';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '../ui/dialog';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent 
} from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import PrincipalAssignment from './PrincipalAssignment';

const AlphaDashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    industry: '',
    principalId: '',
    principalName: '',
    principalEmail: ''
  });

  // Fetch all companies
  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const companiesCollection = collection(db, 'companies');
      const companiesSnapshot = await getDocs(companiesCollection);
      const companiesData = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanies(companiesData);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add new company
  const handleAddCompany = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const newCompany = {
        ...formData,
        createdAt: new Date().toISOString(),
        status: 'active',
        employeeCount: 0,
        projects: 0
      };

      const docRef = await addDoc(collection(db, 'companies'), newCompany);
      
      setCompanies(prev => [...prev, { id: docRef.id, ...newCompany }]);
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        industry: '',
        principalId: '',
        principalName: '',
        principalEmail: ''
      });
      
      setIsAddingCompany(false);
      toast.success('Company added successfully');
    } catch (error) {
      console.error('Error adding company:', error);
      toast.error('Failed to add company');
    } finally {
      setLoading(false);
    }
  };

  // Edit company
  const handleEditCompany = async (e) => {
    e.preventDefault();
    
    if (!selectedCompany) return;

    setLoading(true);
    try {
      const companyRef = doc(db, 'companies', selectedCompany.id);
      await updateDoc(companyRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      });

      setCompanies(prev => prev.map(company => 
        company.id === selectedCompany.id 
          ? { ...company, ...formData, updatedAt: new Date().toISOString() }
          : company
      ));

      setIsEditingCompany(false);
      setSelectedCompany(null);
      toast.success('Company updated successfully');
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Failed to update company');
    } finally {
      setLoading(false);
    }
  };

  // Delete company
  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company?')) {
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'companies', companyId));
      setCompanies(prev => prev.filter(company => company.id !== companyId));
      toast.success('Company deleted successfully');
    } catch (error) {
      console.error('Error deleting company:', error);
      toast.error('Failed to delete company');
    } finally {
      setLoading(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      industry: company.industry || '',
      principalId: company.principalId || '',
      principalName: company.principalName || '',
      principalEmail: company.principalEmail || ''
    });
    setIsEditingCompany(true);
  };

  // Close dialogs
  const closeDialogs = () => {
    setIsAddingCompany(false);
    setIsEditingCompany(false);
    setSelectedCompany(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      industry: '',
      principalId: '',
      principalName: '',
      principalEmail: ''
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alpha Portal</h1>
          <p className="text-gray-600 mt-1">Portal Owner Dashboard - Manage all companies and their owners</p>
        </div>
        <Button onClick={() => setIsAddingCompany(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.filter(c => c.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + (c.employeeCount || 0), 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {companies.reduce((sum, c) => sum + (c.projects || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="principals">Company Owners</TabsTrigger>
          <TabsTrigger value="admins">Company Admins</TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle>Companies</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : companies.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No companies found. Add your first company to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companies.map((company) => (
                    <Card key={company.id} className="border hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{company.name}</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">{company.industry}</p>
                          </div>
                          <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                            {company.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2 text-sm">
                          <p><strong>Email:</strong> {company.email}</p>
                          <p><strong>Phone:</strong> {company.phone}</p>
                          {company.principalName ? (
                            <div>
                              <p><strong>Company Owner:</strong> {company.principalName}</p>
                              <Badge variant="default" className="mt-1">
                                <UserPlus className="w-3 h-3 mr-1" />
                                Owner Assigned
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 mt-1">
                              <UserPlus className="w-3 h-3 mr-1" />
                              No Owner
                            </Badge>
                          )}
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Employees: {company.employeeCount || 0}</span>
                            <span>Projects: {company.projects || 0}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 mt-4">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => openEditDialog(company)}
                            className="flex-1"
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteCompany(company.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Owners Tab */}
        <TabsContent value="principals">
          <PrincipalAssignment 
            companies={companies} 
            onCompanyUpdate={fetchCompanies}
          />
        </TabsContent>

        {/* Company Admins Tab */}
        <TabsContent value="admins">
          <Card>
            <CardHeader>
              <CardTitle>Company Administrators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Company Admin Management coming soon...</p>
                <p className="text-sm mt-2">Here you'll be able to manage company administrators for each company.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Company Dialog */}
      <Dialog open={isAddingCompany} onOpenChange={closeDialogs}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>
              Fill in the company details below to add a new company.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleAddCompany} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <Input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                  placeholder="e.g., Technology, Finance"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="company@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <Input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <Input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Company address"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Principal Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Principal Name
                  </label>
                  <Input
                    type="text"
                    name="principalName"
                    value={formData.principalName}
                    onChange={handleInputChange}
                    placeholder="Principal's full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Principal Email
                  </label>
                  <Input
                    type="email"
                    name="principalEmail"
                    value={formData.principalEmail}
                    onChange={handleInputChange}
                    placeholder="principal@company.com"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialogs}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Company'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Company Dialog */}
      <Dialog open={isEditingCompany} onOpenChange={closeDialogs}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update the company details below.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleEditCompany} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <Input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <Input
                  type="text"
                  name="industry"
                  value={formData.industry}
                  onChange={handleInputChange}
                  placeholder="e.g., Technology, Finance"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <Input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="company@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <Input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <Input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Company address"
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Principal Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Principal Name
                  </label>
                  <Input
                    type="text"
                    name="principalName"
                    value={formData.principalName}
                    onChange={handleInputChange}
                    placeholder="Principal's full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Principal Email
                  </label>
                  <Input
                    type="email"
                    name="principalEmail"
                    value={formData.principalEmail}
                    onChange={handleInputChange}
                    placeholder="principal@company.com"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialogs}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Company'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlphaDashboard;