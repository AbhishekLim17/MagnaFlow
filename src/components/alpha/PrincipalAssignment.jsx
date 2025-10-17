import React, { useState, useEffect } from 'react';
import { Search, UserPlus, User, Building2, Mail, Phone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const PrincipalAssignment = ({ companies, onCompanyUpdate }) => {
  const [principals, setPrincipals] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [selectedPrincipal, setSelectedPrincipal] = useState(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all principals
  const fetchPrincipals = async () => {
    setLoading(true);
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('tier', '==', 'Principal')
      );
      const usersSnapshot = await getDocs(usersQuery);
      const principalsData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPrincipals(principalsData);
    } catch (error) {
      console.error('Error fetching principals:', error);
      toast.error('Failed to fetch principals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrincipals();
  }, []);

  // Filter available principals (not already assigned)
  const availablePrincipals = principals.filter(principal => {
    const isAssigned = companies.some(company => company.principalId === principal.id);
    const matchesSearch = principal.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         principal.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return !isAssigned && matchesSearch;
  });

  // Filter companies without principals
  const companiesWithoutPrincipals = companies.filter(company => !company.principalId);

  // Assign principal to company
  const handleAssignPrincipal = async () => {
    if (!selectedCompany || !selectedPrincipal) {
      toast.error('Please select both a company and a principal');
      return;
    }

    setLoading(true);
    try {
      // Update company with principal information
      const companyRef = doc(db, 'companies', selectedCompany.id);
      await updateDoc(companyRef, {
        principalId: selectedPrincipal.id,
        principalName: selectedPrincipal.name,
        principalEmail: selectedPrincipal.email,
        updatedAt: new Date().toISOString()
      });

      // Update user with company information
      const userRef = doc(db, 'users', selectedPrincipal.id);
      await updateDoc(userRef, {
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        updatedAt: new Date().toISOString()
      });

      toast.success(`${selectedPrincipal.name} assigned to ${selectedCompany.name}`);
      
      // Refresh data
      if (onCompanyUpdate) {
        onCompanyUpdate();
      }
      fetchPrincipals();
      
      // Close dialog
      setIsAssigning(false);
      setSelectedCompany(null);
      setSelectedPrincipal(null);

    } catch (error) {
      console.error('Error assigning principal:', error);
      toast.error('Failed to assign principal');
    } finally {
      setLoading(false);
    }
  };

  // Open assignment dialog
  const openAssignmentDialog = (company) => {
    setSelectedCompany(company);
    setIsAssigning(true);
  };

  // Close dialog
  const closeDialog = () => {
    setIsAssigning(false);
    setSelectedCompany(null);
    setSelectedPrincipal(null);
    setSearchTerm('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Company Owner Assignment</h2>
          <p className="text-gray-600 text-sm">Assign company owners (Principals) to manage their companies</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Company Owners</p>
                <p className="text-2xl font-bold text-blue-600">{availablePrincipals.length}</p>
              </div>
              <User className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Companies Without Owners</p>
                <p className="text-2xl font-bold text-orange-600">{companiesWithoutPrincipals.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Companies With Owners</p>
                <p className="text-2xl font-bold text-green-600">
                  {companies.length - companiesWithoutPrincipals.length}
                </p>
              </div>
              <UserPlus className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies without Principals */}
      {companiesWithoutPrincipals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Companies Needing Owners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companiesWithoutPrincipals.map((company) => (
                <Card key={company.id} className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-gray-900">{company.name}</h3>
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          No Owner
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          <span>{company.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          <span>{company.phone}</span>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={() => openAssignmentDialog(company)}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                        size="sm"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Assign Owner
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment Dialog */}
      <Dialog open={isAssigning} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Assign Company Owner</DialogTitle>
            <DialogDescription>
              Assign a company owner (Principal) to manage {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Company Info */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h4 className="font-medium text-blue-900 mb-2">Selected Company</h4>
                <div className="space-y-1">
                  <p className="font-medium">{selectedCompany?.name}</p>
                  <p className="text-sm text-blue-700">{selectedCompany?.industry}</p>
                  <p className="text-sm text-blue-600">{selectedCompany?.email}</p>
                </div>
              </CardContent>
            </Card>

            {/* Principal Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search and Select Company Owner
              </label>
              
              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search company owners by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Principal List */}
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {loading ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : availablePrincipals.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No available company owners found</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {availablePrincipals.map((principal) => (
                      <div
                        key={principal.id}
                        className={`p-3 cursor-pointer transition-colors ${
                          selectedPrincipal?.id === principal.id
                            ? 'bg-blue-50 border-l-4 border-blue-500'
                            : 'hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedPrincipal(principal)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{principal.name}</p>
                            <p className="text-sm text-gray-600">{principal.email}</p>
                            {principal.department && (
                              <p className="text-xs text-gray-500 mt-1">{principal.department}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">Company Owner</Badge>
                            {selectedPrincipal?.id === principal.id && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Principal Info */}
            {selectedPrincipal && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <h4 className="font-medium text-green-900 mb-2">Selected Company Owner</h4>
                  <div className="space-y-1">
                    <p className="font-medium">{selectedPrincipal.name}</p>
                    <p className="text-sm text-green-700">{selectedPrincipal.email}</p>
                    {selectedPrincipal.department && (
                      <p className="text-sm text-green-600">{selectedPrincipal.department}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssignPrincipal} 
              disabled={!selectedPrincipal || loading}
            >
              {loading ? 'Assigning...' : 'Assign Company Owner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrincipalAssignment;