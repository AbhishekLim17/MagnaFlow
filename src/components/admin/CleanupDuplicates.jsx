import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useDesignations } from '@/contexts/DesignationsContext';
import { useToast } from '@/components/ui/use-toast';

const CleanupDuplicates = () => {
  const { designations, removeDesignation, refreshDesignations } = useDesignations();
  const [cleaning, setCleaning] = useState(false);
  const { toast } = useToast();

  const findDuplicates = () => {
    const seen = new Map();
    const duplicates = [];

    designations.forEach(designation => {
      const nameLower = designation.name.toLowerCase().trim();
      
      if (seen.has(nameLower)) {
        // This is a duplicate - add to list
        duplicates.push({
          id: designation.id,
          name: designation.name,
          originalId: seen.get(nameLower).id
        });
      } else {
        // First occurrence
        seen.set(nameLower, designation);
      }
    });

    return duplicates;
  };

  const handleCleanup = async () => {
    const duplicates = findDuplicates();

    if (duplicates.length === 0) {
      toast({
        title: "No Duplicates Found",
        description: "Your designations database is clean!",
      });
      return;
    }

    if (!confirm(`Found ${duplicates.length} duplicate(s). Delete them?`)) {
      return;
    }

    setCleaning(true);

    let deleted = 0;
    for (const duplicate of duplicates) {
      try {
        await removeDesignation(duplicate.id);
        deleted++;
      } catch (error) {
        console.error('Error deleting duplicate:', error);
      }
    }

    setCleaning(false);
    
    toast({
      title: "Cleanup Complete",
      description: `Removed ${deleted} duplicate designation(s).`,
    });

    await refreshDesignations();
  };

  const duplicates = findDuplicates();

  // Only show if there are duplicates
  if (duplicates.length === 0) {
    return null;
  }

  return (
    <Card className="glass-effect p-4 mb-6 border-2 border-yellow-500/30 bg-yellow-500/5">
      <CardContent className="p-0">
        <div className="flex items-start gap-4">
          <AlertTriangle className="text-yellow-400 w-6 h-6 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">
              Duplicate Designations Detected
            </h3>
            <p className="text-gray-300 mb-3">
              Found <strong className="text-yellow-400">{duplicates.length}</strong> duplicate{duplicates.length > 1 ? 's' : ''}. Click below to clean up your database.
            </p>
            <Button
              onClick={handleCleanup}
              disabled={cleaning}
              size="sm"
              className="bg-red-500 hover:bg-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {cleaning ? 'Cleaning...' : 'Remove All Duplicates'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CleanupDuplicates;
