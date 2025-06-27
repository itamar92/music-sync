import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';

interface EditableTextProps {
  text: string;
  onSave: (newText: string) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
}

export const EditableText: React.FC<EditableTextProps> = ({
  text,
  onSave,
  className = '',
  placeholder = 'Enter text...',
  maxLength = 100,
  multiline = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(text);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditText(text);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== text) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input';
    
    return (
      <div className="flex items-center space-x-2">
        <InputComponent
          ref={inputRef as any}
          type={multiline ? undefined : 'text'}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 ${className}`}
          rows={multiline ? 3 : undefined}
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-400 hover:text-green-300 transition-colors"
          title="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-400 hover:text-red-300 transition-colors"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center space-x-2">
      <span className={className}>{text}</span>
      <button
        onClick={handleStartEdit}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition-all"
        title="Edit"
      >
        <Edit2 className="w-4 h-4" />
      </button>
    </div>
  );
};