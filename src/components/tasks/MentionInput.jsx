import { useState, useRef, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { AtSign } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * MentionInput Component
 * Enhanced textarea with @mention autocomplete functionality
 */
const MentionInput = ({ value, onChange, placeholder, maxLength = 5000, disabled = false }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load users on mount
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          email: doc.data().email,
          role: doc.data().role
        }));
        setUsers(usersList);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    loadUsers();
  }, []);

  // Handle text change
  const handleChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(cursorPos);

    // Check if @ was typed
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    if (atIndex !== -1) {
      const query = textBeforeCursor.slice(atIndex + 1);
      
      // Only show dropdown if query is alphanumeric or empty
      if (/^[a-zA-Z0-9]*$/.test(query)) {
        setMentionQuery(query.toLowerCase());
        
        // Filter users
        const filtered = users.filter(user => 
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5); // Limit to 5 results
        
        setFilteredUsers(filtered);
        setShowDropdown(filtered.length > 0);
        setSelectedIndex(0);
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }
  };

  // Handle user selection
  const selectUser = (user) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    
    // Replace @query with @username
    const newText = 
      textBeforeCursor.slice(0, atIndex) + 
      `@${user.name.replace(/\s+/g, '')} ` + 
      textAfterCursor;
    
    onChange(newText);
    setShowDropdown(false);
    
    // Focus back to textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newCursorPos = atIndex + user.name.replace(/\s+/g, '').length + 2;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < filteredUsers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && filteredUsers.length > 0) {
      e.preventDefault();
      selectUser(filteredUsers[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user avatar
  const getUserAvatar = (name) => {
    return (name || 'U').charAt(0).toUpperCase();
  };

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    return role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
  };

  const remainingChars = maxLength - value.length;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
        rows="3"
        maxLength={maxLength}
        disabled={disabled}
      />
      
      {/* Character counter */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-400">
        {remainingChars} characters remaining
      </div>

      {/* Mention dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-600">
              <AtSign className="w-4 h-4" />
              <span>Select user to mention</span>
            </div>
            
            <div className="max-h-48 overflow-y-auto">
              {filteredUsers.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => selectUser(user)}
                  className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    index === selectedIndex ? 'bg-green-50' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {getUserAvatar(user.name)}
                  </div>
                  
                  {/* User info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">
                        {user.name}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {user.email}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MentionInput;
