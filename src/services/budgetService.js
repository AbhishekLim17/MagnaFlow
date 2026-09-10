// Budget Service — expenses sub-collection under organizations/{orgId}/projects/{projId}/expenses
// Provides full CRUD for expense entries and a budget summary computation.

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

const orgsCol = 'organizations';

// Path helpers
const projectRef = (orgId, projId) =>
  doc(db, orgsCol, orgId, 'projects', projId);

const expensesCol = (orgId, projId) =>
  collection(db, orgsCol, orgId, 'projects', projId, 'expenses');

const expenseRef = (orgId, projId, expId) =>
  doc(db, orgsCol, orgId, 'projects', projId, 'expenses', expId);

// Expenses CRUD

export const getExpenses = async (orgId, projId) => {
  try {
    const q = query(expensesCol(orgId, projId), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
};

export const addExpense = async (orgId, projId, data) => {
  try {
    const currentUser = auth.currentUser;
    const entry = {
      amount: Number(data.amount) || 0,
      description: data.description?.trim() || '',
      category: data.category || 'other',
      date: data.date || new Date().toISOString().split('T')[0],
      addedBy: currentUser?.uid || null,
      addedByName: currentUser?.displayName || data.addedByName || 'Unknown',
      createdAt: Timestamp.now(),
    };
    const ref = await addDoc(expensesCol(orgId, projId), entry);
    return { id: ref.id, ...entry };
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
};

export const updateExpense = async (orgId, projId, expId, updates) => {
  try {
    const patch = { ...updates };
    if (patch.amount !== undefined) patch.amount = Number(patch.amount) || 0;
    await updateDoc(expenseRef(orgId, projId, expId), patch);
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
};

export const deleteExpense = async (orgId, projId, expId) => {
  try {
    await deleteDoc(expenseRef(orgId, projId, expId));
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
};

// Budget Summary

export const computeBudgetSummary = (expenses = [], budget = 0) => {
  const spent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = budget > 0 ? budget - spent : null;
  const pctUsed = budget > 0 ? Math.min((spent / budget) * 100, 999) : null;

  const byCategory = {};
  for (const e of expenses) {
    const cat = e.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + (Number(e.amount) || 0);
  }

  return { spent, budget, remaining, pctUsed, byCategory };
};

// Update budget meta on project document

export const updateProjectBudget = async (orgId, projId, budgetFields) => {
  try {
    await updateDoc(projectRef(orgId, projId), {
      budget: Number(budgetFields.budget) || 0,
      currency: budgetFields.currency || 'USD',
      budgetNotes: budgetFields.budgetNotes || '',
    });
  } catch (error) {
    console.error('Error updating project budget:', error);
    throw error;
  }
};
