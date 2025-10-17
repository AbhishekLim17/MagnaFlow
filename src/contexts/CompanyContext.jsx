import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from './AuthContext';

const CompanyContext = createContext();

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

export const CompanyProvider = ({ children }) => {
  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch all companies (for Alpha users)
  const fetchAllCompanies = async () => {
    setLoading(true);
    try {
      const companiesCollection = collection(db, 'companies');
      const companiesSnapshot = await getDocs(companiesCollection);
      const companiesData = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCompanies(companiesData);
      return companiesData;
    } catch (error) {
      console.error('Error fetching companies:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get company by ID
  const getCompanyById = async (companyId) => {
    try {
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        return { id: companyDoc.id, ...companyDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('Error fetching company:', error);
      throw error;
    }
  };

  // Get company for current user (Principal)
  const getCurrentUserCompany = async () => {
    if (!user) return null;

    try {
      // Check if user is a principal
      if (user.tier === 'Principal') {
        const companiesQuery = query(
          collection(db, 'companies'),
          where('principalId', '==', user.uid)
        );
        const companiesSnapshot = await getDocs(companiesQuery);
        
        if (!companiesSnapshot.empty) {
          const companyData = {
            id: companiesSnapshot.docs[0].id,
            ...companiesSnapshot.docs[0].data()
          };
          setCurrentCompany(companyData);
          return companyData;
        }
      }
      
      // For other users, get company from their profile
      if (user.companyId) {
        const company = await getCompanyById(user.companyId);
        setCurrentCompany(company);
        return company;
      }

      return null;
    } catch (error) {
      console.error('Error fetching current user company:', error);
      throw error;
    }
  };

  // Get employees for a specific company
  const getCompanyEmployees = async (companyId) => {
    try {
      const employeesQuery = query(
        collection(db, 'users'),
        where('companyId', '==', companyId)
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      return employeesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching company employees:', error);
      throw error;
    }
  };

  // Get performance reports for a specific company
  const getCompanyPerformanceReports = async (companyId) => {
    try {
      const reportsQuery = query(
        collection(db, 'performanceReports'),
        where('companyId', '==', companyId)
      );
      const reportsSnapshot = await getDocs(reportsQuery);
      return reportsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching performance reports:', error);
      throw error;
    }
  };

  // Update company employee count
  const updateCompanyStats = async (companyId) => {
    try {
      const employees = await getCompanyEmployees(companyId);
      const employeeCount = employees.length;
      
      // Update the company document with current stats
      const companyRef = doc(db, 'companies', companyId);
      await updateDoc(companyRef, {
        employeeCount,
        lastUpdated: new Date().toISOString()
      });

      // Update local state if this is the current company
      if (currentCompany && currentCompany.id === companyId) {
        setCurrentCompany(prev => ({
          ...prev,
          employeeCount,
          lastUpdated: new Date().toISOString()
        }));
      }

      // Update companies list if it exists
      setCompanies(prev => prev.map(company => 
        company.id === companyId 
          ? { ...company, employeeCount, lastUpdated: new Date().toISOString() }
          : company
      ));

    } catch (error) {
      console.error('Error updating company stats:', error);
      throw error;
    }
  };

  // Initialize company data based on user role
  useEffect(() => {
    if (user) {
      if (user.tier === 'Alpha') {
        fetchAllCompanies();
      } else {
        getCurrentUserCompany();
      }
    }
  }, [user]);

  const value = {
    companies,
    currentCompany,
    loading,
    fetchAllCompanies,
    getCompanyById,
    getCurrentUserCompany,
    getCompanyEmployees,
    getCompanyPerformanceReports,
    updateCompanyStats,
    setCompanies,
    setCurrentCompany
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};

export default CompanyProvider;