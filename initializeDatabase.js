// Database Initialization Script for MagnaFlow
// Run this once to set up your Firebase Firestore database

import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from './src/firebase-config';

// Sample data for testing
const initializeDatabase = async () => {
  console.log('🚀 Initializing MagnaFlow Database...');

  try {
    // 1. Create Alpha User (Portal Owner)
    const alphaUser = {
      name: 'Alpha Administrator',
      email: 'alpha@magnetar.com',
      tier: 'Alpha',
      role: 'admin',
      department: 'Administration',
      designation: 'Portal Owner',
      phone: '+1-800-MAGNETAR',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'users', 'alpha-user-1'), alphaUser);
    console.log('✅ Alpha user created');

    // 2. Create Sample Companies
    const companies = [
      {
        name: 'TechCorp Solutions',
        email: 'info@techcorp.com',
        phone: '+1-555-TECH-001',
        address: '123 Technology Drive, Silicon Valley, CA',
        industry: 'Technology',
        status: 'active',
        employeeCount: 0,
        projects: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Digital Innovations Inc',
        email: 'contact@digitalinnovations.com', 
        phone: '+1-555-DIGI-002',
        address: '456 Innovation Blvd, Austin, TX',
        industry: 'Digital Marketing',
        status: 'active',
        employeeCount: 0,
        projects: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'FinanceFlow Systems',
        email: 'hello@financeflow.com',
        phone: '+1-555-FIN-003', 
        address: '789 Financial Center, New York, NY',
        industry: 'Financial Services',
        status: 'active',
        employeeCount: 0,
        projects: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (let i = 0; i < companies.length; i++) {
      await setDoc(doc(db, 'companies', `company-${i + 1}`), companies[i]);
      console.log(`✅ Company "${companies[i].name}" created`);
    }

    // 3. Create Sample Principal Users (Company Owners)
    const principals = [
      {
        name: 'John Smith',
        email: 'john.smith@techcorp.com',
        tier: 'Principal', 
        role: 'admin',
        department: 'Executive',
        designation: 'CEO',
        phone: '+1-555-001-CEO',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@digitalinnovations.com',
        tier: 'Principal',
        role: 'admin', 
        department: 'Executive',
        designation: 'Founder & CEO',
        phone: '+1-555-002-CEO',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        name: 'Michael Chen',
        email: 'michael.chen@financeflow.com',
        tier: 'Principal',
        role: 'admin',
        department: 'Executive', 
        designation: 'President',
        phone: '+1-555-003-CEO',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (let i = 0; i < principals.length; i++) {
      await setDoc(doc(db, 'users', `principal-${i + 1}`), principals[i]);
      console.log(`✅ Principal "${principals[i].name}" created`);
    }

    // 4. Create Sample Departments
    const departments = [
      // TechCorp Departments
      { name: 'Engineering', companyId: 'company-1', description: 'Software Development' },
      { name: 'Product', companyId: 'company-1', description: 'Product Management' },
      { name: 'Sales', companyId: 'company-1', description: 'Sales & Business Development' },
      
      // Digital Innovations Departments  
      { name: 'Marketing', companyId: 'company-2', description: 'Digital Marketing' },
      { name: 'Creative', companyId: 'company-2', description: 'Creative & Design' },
      { name: 'Analytics', companyId: 'company-2', description: 'Data Analytics' },
      
      // FinanceFlow Departments
      { name: 'Finance', companyId: 'company-3', description: 'Financial Services' },
      { name: 'Operations', companyId: 'company-3', description: 'Operations Management' },
      { name: 'Compliance', companyId: 'company-3', description: 'Regulatory Compliance' }
    ];

    for (let i = 0; i < departments.length; i++) {
      const deptData = {
        ...departments[i],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'departments', `dept-${i + 1}`), deptData);
    }
    console.log('✅ Sample departments created');

    // 5. Create Sample Designations
    const designations = [
      // Engineering Designations
      { title: 'Senior Software Engineer', department: 'Engineering', companyId: 'company-1', level: 'Senior' },
      { title: 'Software Engineer', department: 'Engineering', companyId: 'company-1', level: 'Mid-Level' },
      { title: 'Junior Developer', department: 'Engineering', companyId: 'company-1', level: 'Junior' },
      
      // Marketing Designations
      { title: 'Marketing Manager', department: 'Marketing', companyId: 'company-2', level: 'Senior' },
      { title: 'Digital Marketing Specialist', department: 'Marketing', companyId: 'company-2', level: 'Mid-Level' },
      
      // Finance Designations
      { title: 'Financial Analyst', department: 'Finance', companyId: 'company-3', level: 'Mid-Level' },
      { title: 'Senior Financial Advisor', department: 'Finance', companyId: 'company-3', level: 'Senior' }
    ];

    for (let i = 0; i < designations.length; i++) {
      const designationData = {
        ...designations[i],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'designations', `designation-${i + 1}`), designationData);
    }
    console.log('✅ Sample designations created');

    console.log('🎉 Database initialization complete!');
    console.log('\n📝 Test Accounts Created:');
    console.log('Alpha Account: alpha@magnetar.com');
    console.log('Principal 1: john.smith@techcorp.com');
    console.log('Principal 2: sarah.johnson@digitalinnovations.com'); 
    console.log('Principal 3: michael.chen@financeflow.com');
    console.log('\n⚠️  Remember to set passwords through Firebase Authentication!');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

// Uncomment to run initialization
// initializeDatabase();

export default initializeDatabase;