import React, { useState, useMemo } from 'react';
import { 
  FolderTree, Plus, Edit2, Trash2, Search, Filter, Layers, 
  Sparkles, CheckCircle2, AlertTriangle, Pill, Palette, 
  ArrowRight, ShieldCheck, Tag, X, Check, RefreshCw, Box,
  LayoutGrid, List, Save, Loader2
} from 'lucide-react';
import { ProductCategory, SubCategory, Medicine } from '../types.ts';

interface CategoryManagerPanelProps {
  currentUser: any;
  categories: ProductCategory[];
  medicines: Medicine[];
  onDataChanged: () => void;
}

const COLOR_OPTIONS = [
  { name: 'Emerald', bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200', lightBg: 'bg-emerald-50' },
  { name: 'Indigo', bg: 'bg-indigo-500', text: 'text-indigo-700', border: 'border-indigo-200', lightBg: 'bg-indigo-50' },
  { name: 'Blue', bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-200', lightBg: 'bg-blue-50' },
  { name: 'Purple', bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-200', lightBg: 'bg-purple-50' },
  { name: 'Rose', bg: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-200', lightBg: 'bg-rose-50' },
  { name: 'Amber', bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-200', lightBg: 'bg-amber-50' },
  { name: 'Teal', bg: 'bg-teal-500', text: 'text-teal-700', border: 'border-teal-200', lightBg: 'bg-teal-50' },
  { name: 'Cyan', bg: 'bg-cyan-500', text: 'text-cyan-700', border: 'border-cyan-200', lightBg: 'bg-cyan-50' },
  { name: 'Fuchsia', bg: 'bg-fuchsia-500', text: 'text-fuchsia-700', border: 'border-fuchsia-200', lightBg: 'bg-fuchsia-50' },
  { name: 'Slate', bg: 'bg-slate-500', text: 'text-slate-700', border: 'border-slate-200', lightBg: 'bg-slate-50' }
];

export default function CategoryManagerPanel({
  currentUser,
  categories = [],
  medicines = [],
  onDataChanged
}: CategoryManagerPanelProps) {
  // View mode: grid or table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'medicine' | 'cosmetics' | 'general'>('all');

  // Staged / Local working categories for "Save Once" workflow
  const [workingCategories, setWorkingCategories] = useState<ProductCategory[]>(categories);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync workingCategories when categories prop updates and there are no unsaved changes
  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setWorkingCategories(categories);
    }
  }, [categories, hasUnsavedChanges]);

  // Modal States
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ProductCategory | null>(null);

  // Inline Category Quick Editing
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineName, setInlineName] = useState('');
  const [inlineType, setInlineType] = useState<'medicine' | 'cosmetics' | 'general'>('medicine');
  const [inlineColor, setInlineColor] = useState('Emerald');
  const [inlineDesc, setInlineDesc] = useState('');
  const [isInlineSaving, setIsInlineSaving] = useState(false);

  // Subcategory Modals & Quick Add
  const [activeCategoryForSub, setActiveCategoryForSub] = useState<ProductCategory | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{ categoryId: string; sub: SubCategory } | null>(null);
  const [deletingSubcategory, setDeletingSubcategory] = useState<{ categoryId: string; sub: SubCategory } | null>(null);
  const [quickSubInputs, setQuickSubInputs] = useState<Record<string, string>>({});

  // Add / Edit Category Form State
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<'medicine' | 'cosmetics' | 'general'>('medicine');
  const [catColor, setCatColor] = useState('Emerald');
  const [catDescription, setCatDescription] = useState('');
  const [initialSubList, setInitialSubList] = useState<{ id?: string; name: string; description?: string }[]>([]);
  const [newSubTagInput, setNewSubTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subcategory Form State
  const [subName, setSubName] = useState('');
  const [subDescription, setSubDescription] = useState('');
  const [isSubSubmitting, setIsSubSubmitting] = useState(false);

  // Stats Calculations
  const stats = useMemo(() => {
    const totalCategories = workingCategories.length;
    const medicineCats = workingCategories.filter(c => (c.type || c.productType || 'medicine') === 'medicine').length;
    const cosmeticCats = workingCategories.filter(c => (c.type || c.productType) === 'cosmetics').length;
    const generalCats = workingCategories.filter(c => (c.type || c.productType) === 'general').length;
    const totalSubcategories = workingCategories.reduce((sum, c) => sum + ((c.subCategories || c.subcategories)?.length || 0), 0);
    const categorizedProducts = medicines.filter(m => m.category && m.category.trim() !== '').length;

    return { totalCategories, medicineCats, cosmeticCats, generalCats, totalSubcategories, categorizedProducts };
  }, [workingCategories, medicines]);

  // Product Count per category & subcategory helper
  const getProductCountForCategory = (catNameStr: string) => {
    const target = catNameStr.trim().toLowerCase();
    return medicines.filter(m => (m.category || '').trim().toLowerCase() === target).length;
  };

  const getProductCountForSubcategory = (catNameStr: string, subNameStr: string) => {
    const catTarget = catNameStr.trim().toLowerCase();
    const subTarget = subNameStr.trim().toLowerCase();
    return medicines.filter(m => 
      (m.category || '').trim().toLowerCase() === catTarget && 
      (m.subCategory || '').trim().toLowerCase() === subTarget
    ).length;
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return workingCategories.filter(cat => {
      const cType = (cat.type || cat.productType || 'medicine') as 'medicine' | 'cosmetics' | 'general';
      const matchesType = typeFilter === 'all' || cType === typeFilter;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesType;

      const subList = cat.subCategories || cat.subcategories || [];
      const matchesCatName = cat.name.toLowerCase().includes(query);
      const matchesDesc = (cat.description || '').toLowerCase().includes(query);
      const matchesSub = subList.some(s => s.name.toLowerCase().includes(query));

      return matchesType && (matchesCatName || matchesDesc || matchesSub);
    });
  }, [workingCategories, typeFilter, searchQuery]);

  // Handle Batch Save All Once
  const handleSaveAllBatch = async () => {
    setIsBatchSaving(true);
    try {
      const res = await fetch('/api/categories/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: workingCategories,
          operatorId: currentUser?.id || 'admin'
        })
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        setSaveSuccessMsg('All categories and subcategories saved successfully!');
        setTimeout(() => setSaveSuccessMsg(null), 3500);
        onDataChanged();
      } else {
        const data = await res.json();
        alert(`Error saving categories: ${data.error || 'Failed to batch save'}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsBatchSaving(false);
    }
  };

  // Handle Open Create Modal
  const openCreateModal = () => {
    setCatName('');
    setCatType('medicine');
    setCatColor('Emerald');
    setCatDescription('');
    setInitialSubList([]);
    setNewSubTagInput('');
    setShowAddCatModal(true);
  };

  // Handle Open Edit Modal
  const openEditModal = (cat: ProductCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatType(((cat.type || cat.productType || 'medicine') as 'medicine' | 'cosmetics' | 'general'));
    setCatColor(cat.color || 'Emerald');
    setCatDescription(cat.description || '');
    const currentSubs = cat.subCategories || cat.subcategories || [];
    setInitialSubList(currentSubs.map(s => ({ id: s.id, name: s.name, description: s.description || '' })));
    setNewSubTagInput('');
  };

  // Handle Add Initial Sub Tag
  const handleAddInitialSubTag = () => {
    const trimmed = newSubTagInput.trim();
    if (trimmed && !initialSubList.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setInitialSubList([...initialSubList, { id: `sub_${Date.now()}_${initialSubList.length}`, name: trimmed, description: '' }]);
      setNewSubTagInput('');
    }
  };

  // Handle Remove Sub Tag in modal
  const handleRemoveSubTag = (index: number) => {
    setInitialSubList(initialSubList.filter((_, i) => i !== index));
  };

  // Start Inline Edit
  const startInlineEdit = (cat: ProductCategory) => {
    setInlineEditId(cat.id);
    setInlineName(cat.name);
    setInlineType(((cat.type || cat.productType || 'medicine') as 'medicine' | 'cosmetics' | 'general'));
    setInlineColor(cat.color || 'Emerald');
    setInlineDesc(cat.description || '');
  };

  // Save Inline Edit Directly to Database
  const handleSaveInlineEdit = async (catId: string) => {
    if (!inlineName.trim()) {
      alert('Validation Error: Category name cannot be empty.');
      return;
    }

    setIsInlineSaving(true);
    try {
      const existingCat = workingCategories.find(c => c.id === catId);
      const res = await fetch(`/api/categories/${catId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inlineName.trim(),
          productType: inlineType,
          color: inlineColor,
          description: inlineDesc.trim(),
          subCategories: existingCat?.subCategories || existingCat?.subcategories || []
        })
      });

      if (res.ok) {
        const saved = await res.json();
        const updated = workingCategories.map(c => c.id === catId ? { ...c, ...saved, type: inlineType, productType: inlineType, color: inlineColor, name: inlineName.trim(), description: inlineDesc.trim() } : c);
        setWorkingCategories(updated);
        setInlineEditId(null);
        setSaveSuccessMsg(`Category "${inlineName.trim()}" saved directly to database!`);
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Failed to save category: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Network error saving category: ${e.message}`);
    } finally {
      setIsInlineSaving(false);
    }
  };

  // Save / Create Category (Supports direct database persist & staged save)
  const handleSaveCategory = async (e: React.FormEvent, persistToDb: boolean = true) => {
    e.preventDefault();
    if (!catName.trim()) {
      alert('Validation Error: Category name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingCategory) {
        if (persistToDb) {
          const res = await fetch(`/api/categories/${editingCategory.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: catName.trim(),
              productType: catType,
              color: catColor,
              description: catDescription.trim(),
              subCategories: initialSubList
            })
          });

          if (res.ok) {
            const saved = await res.json();
            const updated = workingCategories.map(c => c.id === editingCategory.id ? { ...c, ...saved, type: catType, productType: catType, color: catColor, name: catName.trim(), description: catDescription.trim(), subCategories: initialSubList, subcategories: initialSubList } : c);
            setWorkingCategories(updated);
            setEditingCategory(null);
            setSaveSuccessMsg(`Category "${catName.trim()}" updated and saved to database!`);
            setTimeout(() => setSaveSuccessMsg(null), 3500);
            onDataChanged();
          } else {
            const err = await res.json();
            alert(`Error updating category: ${err.error || 'Failed to update'}`);
          }
        } else {
          // Staged local update
          const updated = workingCategories.map(c => {
            if (c.id === editingCategory.id) {
              return {
                ...c,
                name: catName.trim(),
                type: catType,
                productType: catType,
                color: catColor,
                description: catDescription.trim(),
                subCategories: initialSubList as any,
                subcategories: initialSubList as any
              };
            }
            return c;
          });
          setWorkingCategories(updated);
          setHasUnsavedChanges(true);
          setEditingCategory(null);
        }
      } else {
        // Create new category
        if (persistToDb) {
          const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: catName.trim(),
              productType: catType,
              color: catColor,
              description: catDescription.trim(),
              subCategories: initialSubList
            })
          });

          if (res.ok) {
            const created = await res.json();
            setWorkingCategories([...workingCategories, created]);
            setShowAddCatModal(false);
            setSaveSuccessMsg(`Category "${catName.trim()}" created and saved to database!`);
            setTimeout(() => setSaveSuccessMsg(null), 3500);
            onDataChanged();
          } else {
            const err = await res.json();
            alert(`Error creating category: ${err.error || 'Failed to create'}`);
          }
        } else {
          // Staged new category
          const subObjs = initialSubList.map((s, idx) => ({
            id: s.id || `sub_${Date.now()}_${idx}`,
            name: s.name,
            description: s.description || ''
          }));

          const newCatObj: ProductCategory = {
            id: `cat_${Date.now()}`,
            name: catName.trim(),
            type: catType,
            productType: catType,
            color: catColor,
            description: catDescription.trim(),
            subCategories: subObjs,
            subcategories: subObjs,
            isCustom: true
          };

          setWorkingCategories([...workingCategories, newCatObj]);
          setHasUnsavedChanges(true);
          setShowAddCatModal(false);
        }
      }
    } catch (err: any) {
      alert(`Network error saving category: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Inline Add Subcategory
  const handleQuickAddSub = async (categoryId: string) => {
    const inputVal = (quickSubInputs[categoryId] || '').trim();
    if (!inputVal) return;

    try {
      const res = await fetch(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inputVal, description: '' })
      });

      if (res.ok) {
        const updatedCat = await res.json();
        const updated = workingCategories.map(c => c.id === categoryId ? { ...c, ...updatedCat } : c);
        setWorkingCategories(updated);
        setQuickSubInputs({ ...quickSubInputs, [categoryId]: '' });
        setSaveSuccessMsg(`Subcategory "${inputVal}" added and saved!`);
        setTimeout(() => setSaveSuccessMsg(null), 2500);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error: ${err.error || 'Could not add subcategory'}`);
      }
    } catch (e: any) {
      // Fallback to local working categories if network fails
      const updated = workingCategories.map(c => {
        if (c.id === categoryId) {
          const subs = c.subCategories || c.subcategories || [];
          if (subs.some(s => s.name.toLowerCase() === inputVal.toLowerCase())) {
            alert(`Subcategory "${inputVal}" already exists in this category.`);
            return c;
          }
          const newSub: SubCategory = {
            id: `sub_${Date.now()}`,
            name: inputVal,
            description: ''
          };
          return {
            ...c,
            subCategories: [...subs, newSub],
            subcategories: [...subs, newSub]
          };
        }
        return c;
      });

      setWorkingCategories(updated);
      setHasUnsavedChanges(true);
      setQuickSubInputs({ ...quickSubInputs, [categoryId]: '' });
    }
  };

  // Delete Category Directly from DB
  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/categories/${deletingCategory.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const updated = workingCategories.filter(c => c.id !== deletingCategory.id);
        setWorkingCategories(updated);
        setSaveSuccessMsg(`Category "${deletingCategory.name}" deleted and changes saved!`);
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        setDeletingCategory(null);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error deleting category: ${err.error || 'Failed to delete'}`);
      }
    } catch (e: any) {
      const updated = workingCategories.filter(c => c.id !== deletingCategory.id);
      setWorkingCategories(updated);
      setHasUnsavedChanges(true);
      setDeletingCategory(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Add Subcategory Modal
  const openAddSubcategoryModal = (cat: ProductCategory) => {
    setActiveCategoryForSub(cat);
    setSubName('');
    setSubDescription('');
  };

  // Open Edit Subcategory Modal
  const openEditSubcategoryModal = (categoryId: string, sub: SubCategory) => {
    setEditingSubcategory({ categoryId, sub });
    setSubName(sub.name);
    setSubDescription(sub.description || '');
  };

  // Save Subcategory Directly to DB
  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim()) {
      alert('Validation Error: Subcategory name is required.');
      return;
    }

    setIsSubSubmitting(true);

    try {
      if (editingSubcategory) {
        const res = await fetch(`/api/categories/${editingSubcategory.categoryId}/subcategories/${editingSubcategory.sub.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: subName.trim(),
            description: subDescription.trim()
          })
        });

        if (res.ok) {
          const updatedCat = await res.json();
          const updated = workingCategories.map(c => c.id === editingSubcategory.categoryId ? { ...c, ...updatedCat } : c);
          setWorkingCategories(updated);
          setEditingSubcategory(null);
          setSaveSuccessMsg(`Subcategory "${subName.trim()}" updated and saved!`);
          setTimeout(() => setSaveSuccessMsg(null), 3000);
          onDataChanged();
        } else {
          const err = await res.json();
          alert(`Error saving subcategory: ${err.error || 'Failed to save'}`);
        }
      } else if (activeCategoryForSub) {
        const res = await fetch(`/api/categories/${activeCategoryForSub.id}/subcategories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: subName.trim(),
            description: subDescription.trim()
          })
        });

        if (res.ok) {
          const updatedCat = await res.json();
          const updated = workingCategories.map(c => c.id === activeCategoryForSub.id ? { ...c, ...updatedCat } : c);
          setWorkingCategories(updated);
          setActiveCategoryForSub(null);
          setSaveSuccessMsg(`Subcategory "${subName.trim()}" created and saved!`);
          setTimeout(() => setSaveSuccessMsg(null), 3000);
          onDataChanged();
        } else {
          const err = await res.json();
          alert(`Error adding subcategory: ${err.error || 'Failed to add'}`);
        }
      }
    } catch (err: any) {
      alert(`Network error saving subcategory: ${err.message}`);
    } finally {
      setIsSubSubmitting(false);
    }
  };

  // Delete Subcategory Directly from DB
  const handleDeleteSubcategory = async () => {
    if (!deletingSubcategory) return;
    setIsSubSubmitting(true);
    try {
      const res = await fetch(`/api/categories/${deletingSubcategory.categoryId}/subcategories/${deletingSubcategory.sub.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const updated = workingCategories.map(c => {
          if (c.id === deletingSubcategory.categoryId) {
            const subs = (c.subCategories || c.subcategories || []).filter(s => s.id !== deletingSubcategory.sub.id);
            return { ...c, subCategories: subs, subcategories: subs };
          }
          return c;
        });
        setWorkingCategories(updated);
        setDeletingSubcategory(null);
        setSaveSuccessMsg(`Subcategory "${deletingSubcategory.sub.name}" deleted and saved!`);
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        onDataChanged();
      } else {
        const err = await res.json();
        alert(`Error deleting subcategory: ${err.error || 'Failed to delete'}`);
      }
    } catch (e: any) {
      const updated = workingCategories.map(c => {
        if (c.id === deletingSubcategory.categoryId) {
          const subs = (c.subCategories || c.subcategories || []).filter(s => s.id !== deletingSubcategory.sub.id);
          return { ...c, subCategories: subs, subcategories: subs };
        }
        return c;
      });
      setWorkingCategories(updated);
      setHasUnsavedChanges(true);
      setDeletingSubcategory(null);
    } finally {
      setIsSubSubmitting(false);
    }
  };

  // Helper for color styles
  const getColorClasses = (colorName?: string) => {
    const found = COLOR_OPTIONS.find(c => c.name.toLowerCase() === (colorName || 'emerald').toLowerCase());
    return found || COLOR_OPTIONS[0];
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Controls */}
      <div className="bg-white rounded-xl border border-gray-150 p-5 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                <FolderTree className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  Category & Subcategory Hierarchy Management
                </h3>
                <p className="text-xs text-gray-500">
                  Configure inventory product classifications, therapeutic categories, cosmetics groupings, and subcategories.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {hasUnsavedChanges && (
              <button
                onClick={() => {
                  if (confirm('Discard all unsaved category changes?')) {
                    setWorkingCategories(categories);
                    setHasUnsavedChanges(false);
                  }
                }}
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-bold text-xs py-2 px-3 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Discard Changes
              </button>
            )}

            <button
              onClick={handleSaveAllBatch}
              disabled={isBatchSaving}
              className={`font-bold text-xs py-2 px-4 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                hasUnsavedChanges 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400 animate-pulse' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
              {isBatchSaving ? 'Saving Changes...' : hasUnsavedChanges ? 'Save Changes (Save Once)' : 'Save Hierarchy'}
            </button>

            <button
              onClick={openCreateModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              Create Category
            </button>
          </div>
        </div>

        {/* Success / Status Alerts */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl flex items-center gap-2 text-emerald-900 font-bold text-xs animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {hasUnsavedChanges && (
          <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl flex items-center justify-between gap-3 text-amber-900 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span><strong>Unsaved Changes:</strong> You have added, modified, or removed categories/subcategories. Click <strong>"Save Changes"</strong> to apply all changes across the database and inventory products.</span>
            </div>
            <button
              onClick={handleSaveAllBatch}
              disabled={isBatchSaving}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg font-bold shrink-0 cursor-pointer shadow-xs"
            >
              {isBatchSaving ? 'Saving...' : 'Save Once Now'}
            </button>
          </div>
        )}

        {/* Quick Statistics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Categories</span>
            <span className="text-lg font-black text-slate-900 font-mono">{stats.totalCategories}</span>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-200/70 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-emerald-700 block">Medicines</span>
            <span className="text-lg font-black text-emerald-900 font-mono">{stats.medicineCats}</span>
          </div>

          <div className="bg-rose-50/50 border border-rose-200/70 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Cosmetics</span>
            <span className="text-lg font-black text-rose-900 font-mono">{stats.cosmeticCats}</span>
          </div>

          <div className="bg-blue-50/50 border border-blue-200/70 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-blue-700 block">General</span>
            <span className="text-lg font-black text-blue-900 font-mono">{stats.generalCats}</span>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-200/70 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-indigo-700 block">Subcategories</span>
            <span className="text-lg font-black text-indigo-900 font-mono">{stats.totalSubcategories}</span>
          </div>

          <div className="bg-amber-50/50 border border-amber-200/70 p-3 rounded-lg">
            <span className="text-[10px] uppercase font-bold text-amber-700 block">Products Cataloged</span>
            <span className="text-lg font-black text-amber-900 font-mono">{stats.categorizedProducts}</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-150 text-xs">
          {/* Classification Filter Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                typeFilter === 'all' 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              All Types ({categories.length})
            </button>
            <button
              onClick={() => setTypeFilter('medicine')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                typeFilter === 'medicine' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <Pill className="h-3 w-3" />
              Medicines ({stats.medicineCats})
            </button>
            <button
              onClick={() => setTypeFilter('cosmetics')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                typeFilter === 'cosmetics' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              Cosmetics ({stats.cosmeticCats})
            </button>
            <button
              onClick={() => setTypeFilter('general')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                typeFilter === 'general' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
              }`}
            >
              <Box className="h-3 w-3" />
              General ({stats.generalCats})
            </button>
          </div>

          {/* View Toggle & Search Box */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center bg-white border border-gray-250 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                title="Table / List View (Quick Edit)"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search category or subcategory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-250 text-gray-800 rounded-lg pl-9 pr-8 py-1.5 font-medium outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Categories Content: Table or Grid View */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center space-y-3">
          <FolderTree className="h-10 w-10 text-gray-300 mx-auto" />
          <h4 className="text-sm font-bold text-gray-800">No categories found</h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery 
              ? `No categories or subcategories matched "${searchQuery}". Try changing your search or classification filter.`
              : 'Start by creating your first inventory category to organize products and subcategories.'}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="bg-emerald-600 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm inline-flex items-center gap-1.5 mt-2"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              Create First Category
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE / LIST VIEW with Quick Inline Editing */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Color Badge</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Subcategories</th>
                  <th className="py-3 px-4">Products</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
                {filteredCategories.map(cat => {
                  const isInline = inlineEditId === cat.id;
                  const color = getColorClasses(isInline ? inlineColor : cat.color);
                  const totalProducts = getProductCountForCategory(cat.name);
                  const subList = cat.subCategories || cat.subcategories || [];
                  const cType = isInline ? inlineType : (cat.type || cat.productType || 'medicine');

                  if (isInline) {
                    return (
                      <tr key={cat.id} className="bg-blue-50/50 border-l-4 border-l-blue-600 animate-in fade-in">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={inlineName}
                            onChange={(e) => setInlineName(e.target.value)}
                            className="bg-white border border-blue-400 rounded-md px-2.5 py-1 text-xs font-bold text-gray-900 w-full outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Category Name"
                            autoFocus
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={inlineType}
                            onChange={(e) => setInlineType(e.target.value as any)}
                            className="bg-white border border-gray-300 rounded-md px-2 py-1 text-xs font-semibold outline-none"
                          >
                            <option value="medicine">💊 Medicine</option>
                            <option value="cosmetics">💄 Cosmetics</option>
                            <option value="general">📦 General</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={inlineColor}
                            onChange={(e) => setInlineColor(e.target.value)}
                            className="bg-white border border-gray-300 rounded-md px-2 py-1 text-xs font-semibold outline-none"
                          >
                            {COLOR_OPTIONS.map(c => (
                              <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={inlineDesc}
                            onChange={(e) => setInlineDesc(e.target.value)}
                            className="bg-white border border-gray-300 rounded-md px-2.5 py-1 text-xs text-gray-700 w-full outline-none"
                            placeholder="Description..."
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-500 font-mono">{subList.length} subcategories</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-800">{totalProducts} items</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSaveInlineEdit(cat.id)}
                              disabled={isInlineSaving || !inlineName.trim()}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                            >
                              {isInlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineEditId(null)}
                              className="bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 px-2.5 py-1 rounded-md font-bold text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={cat.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-900 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${color.bg} shrink-0`} />
                        <span>{cat.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          cType === 'medicine' 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                            : cType === 'cosmetics' 
                            ? 'bg-rose-100 text-rose-800 border-rose-300' 
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}>
                          {cType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${color.lightBg} ${color.text} border ${color.border}`}>
                          {cat.color || 'Emerald'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate" title={cat.description || ''}>
                        {cat.description || <span className="text-gray-300 italic">None</span>}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap max-w-xs">
                          {subList.length === 0 ? (
                            <span className="text-gray-400 text-[11px] italic">0 subcategories</span>
                          ) : (
                            subList.slice(0, 3).map(s => (
                              <span key={s.id} className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-700">
                                {s.name}
                              </span>
                            ))
                          )}
                          {subList.length > 3 && (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                              +{subList.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {totalProducts} items
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startInlineEdit(cat)}
                            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Quick Inline Edit"
                          >
                            <Edit2 className="h-2.5 w-2.5" />
                            Quick Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(cat)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded-md font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                            title="Open Full Category & Subcategory Editor"
                          >
                            <Layers className="h-2.5 w-2.5" />
                            Full Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCategory(cat)}
                            className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 p-1 rounded-md transition-colors cursor-pointer"
                            title="Delete Category"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCategories.map(cat => {
            const isInline = inlineEditId === cat.id;
            const color = getColorClasses(isInline ? inlineColor : cat.color);
            const totalProducts = getProductCountForCategory(cat.name);
            const subList = cat.subCategories || cat.subcategories || [];
            const subCount = subList.length;
            const cType = isInline ? inlineType : (cat.type || cat.productType || 'medicine');

            if (isInline) {
              return (
                <div key={cat.id} className="bg-white rounded-xl border-2 border-blue-400 p-4 shadow-md space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="font-bold text-xs text-blue-800 flex items-center gap-1">
                      <Edit2 className="h-3.5 w-3.5" /> Quick Edit Category
                    </span>
                    <button
                      type="button"
                      onClick={() => setInlineEditId(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="font-bold text-gray-700 block text-[11px]">Category Name *</label>
                      <input
                        type="text"
                        value={inlineName}
                        onChange={(e) => setInlineName(e.target.value)}
                        className="w-full bg-white border border-blue-400 p-1.5 rounded-lg font-bold text-gray-900 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-bold text-gray-700 block text-[11px]">Type</label>
                        <select
                          value={inlineType}
                          onChange={(e) => setInlineType(e.target.value as any)}
                          className="w-full bg-white border border-gray-300 p-1.5 rounded-lg text-xs font-semibold"
                        >
                          <option value="medicine">💊 Medicine</option>
                          <option value="cosmetics">💄 Cosmetics</option>
                          <option value="general">📦 General</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 block text-[11px]">Color</label>
                        <select
                          value={inlineColor}
                          onChange={(e) => setInlineColor(e.target.value)}
                          className="w-full bg-white border border-gray-300 p-1.5 rounded-lg text-xs font-semibold"
                        >
                          {COLOR_OPTIONS.map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block text-[11px]">Description</label>
                      <input
                        type="text"
                        value={inlineDesc}
                        onChange={(e) => setInlineDesc(e.target.value)}
                        className="w-full bg-white border border-gray-300 p-1.5 rounded-lg text-xs text-gray-700"
                        placeholder="Description..."
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t justify-end">
                    <button
                      type="button"
                      onClick={() => setInlineEditId(null)}
                      className="bg-white border border-gray-300 px-3 py-1 rounded-lg font-bold text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveInlineEdit(cat.id)}
                      disabled={isInlineSaving || !inlineName.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isInlineSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Directly
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={cat.id} 
                className="bg-white rounded-xl border border-gray-200/90 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Header Banner */}
                <div>
                  <div className={`p-4 border-b border-gray-100 flex items-start justify-between gap-3 ${color.lightBg}/40`}>
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`h-2.5 w-2.5 rounded-full ${color.bg} shrink-0`} />
                        <h4 className="font-bold text-gray-900 text-sm truncate" title={cat.name}>
                          {cat.name}
                        </h4>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          cType === 'medicine' 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                            : cType === 'cosmetics' 
                            ? 'bg-rose-100 text-rose-800 border-rose-300' 
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}>
                          {cType}
                        </span>
                      </div>
                      {cat.description && (
                        <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                          {cat.description}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Products</span>
                      <span className="text-xs font-mono font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-2xs">
                        {totalProducts} items
                      </span>
                    </div>
                  </div>

                  {/* Subcategories Container */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-indigo-500" />
                        Subcategories ({subCount})
                      </span>
                      <button
                        onClick={() => openAddSubcategoryModal(cat)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="h-3 w-3 stroke-[2.5]" />
                        Add Subcategory
                      </button>
                    </div>

                    {subCount === 0 ? (
                      <div className="bg-gray-50/80 border border-dashed border-gray-200 rounded-lg p-3 text-center">
                        <p className="text-[11px] text-gray-400">No subcategories created yet.</p>
                        <button
                          onClick={() => openAddSubcategoryModal(cat)}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 mt-1 inline-flex items-center gap-1 cursor-pointer"
                        >
                          + Add first subcategory
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {subList.map(sub => {
                          const subProductCount = getProductCountForSubcategory(cat.name, sub.name);
                          return (
                            <div
                              key={sub.id}
                              className="group/sub relative bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-lg pl-2.5 pr-1.5 py-1 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
                              title={sub.description || sub.name}
                            >
                              <span>{sub.name}</span>
                              {subProductCount > 0 && (
                                <span className="bg-white text-slate-600 font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border border-slate-200">
                                  {subProductCount}
                                </span>
                              )}
                              
                              <div className="flex items-center gap-0.5 ml-1 border-l border-slate-200 pl-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditSubcategoryModal(cat.id, sub);
                                  }}
                                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                  title="Edit subcategory"
                                >
                                  <Edit2 className="h-2.5 w-2.5" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingSubcategory({ categoryId: cat.id, sub });
                                  }}
                                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                  title="Delete subcategory"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick Subcategory Inline Input */}
                    <div className="pt-2 border-t border-gray-100 flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="+ Add subcategory..."
                        value={quickSubInputs[cat.id] || ''}
                        onChange={(e) => setQuickSubInputs({ ...quickSubInputs, [cat.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleQuickAddSub(cat.id);
                          }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-medium outline-none focus:bg-white focus:border-indigo-400 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuickAddSub(cat.id)}
                        disabled={!(quickSubInputs[cat.id] || '').trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold px-2 py-1 rounded-lg text-[10px] cursor-pointer shadow-2xs"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => startInlineEdit(cat)}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs text-[11px]"
                    title="Quick Edit in Card"
                  >
                    <Edit2 className="h-3 w-3" />
                    Quick
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(cat)}
                    className="flex-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs text-[11px]"
                  >
                    <Layers className="h-3 w-3" />
                    Edit Category
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingCategory(cat)}
                    className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                    title="Delete Category"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Create / Add Category */}
      {showAddCatModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <FolderTree className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Create New Category</h3>
                  <p className="text-[11px] text-gray-500">Add an inventory classification and define its subcategories</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddCatModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-gray-700 block">Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Antibiotics, Cardiovascular, Skin Care"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none focus:border-emerald-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block">Product Type Classification</label>
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as any)}
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium text-gray-700 cursor-pointer"
                  >
                    <option value="medicine">💊 Medicine</option>
                    <option value="cosmetics">💄 Cosmetics & Beauty</option>
                    <option value="general">📦 General Inventory</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block">Badge Theme Color</label>
                  <select
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium text-gray-700 cursor-pointer"
                  >
                    {COLOR_OPTIONS.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Provide therapeutic notes or regulatory guidelines for this category..."
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium"
                />
              </div>

              {/* Initial Subcategories Builder */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    Add Initial Subcategories
                  </label>
                  <span className="text-[10px] text-slate-500">{initialSubList.length} subcategories added</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Tablets, Creams, Syrups, Injectables"
                    value={newSubTagInput}
                    onChange={(e) => setNewSubTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInitialSubTag();
                      }
                    }}
                    className="flex-1 bg-white border border-slate-300 p-2 rounded-lg outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddInitialSubTag}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-lg text-xs cursor-pointer shadow-2xs"
                  >
                    Add Tag
                  </button>
                </div>

                {initialSubList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                    {initialSubList.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-white border border-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 shadow-2xs"
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => setInitialSubList(initialSubList.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddCatModal(false)}
                  className="bg-white border border-gray-300 py-2 px-4 rounded-lg text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !catName.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Creating Category...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Category */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Edit Category</h3>
                  <p className="text-[11px] text-gray-500">
                    Modifying name will automatically update {getProductCountForCategory(editingCategory.name)} assigned medicines
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingCategory(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-bold text-gray-700 block">Category Name *</label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none focus:border-blue-600 font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block">Product Type Classification</label>
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as any)}
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium text-gray-700 cursor-pointer"
                  >
                    <option value="medicine">💊 Medicine</option>
                    <option value="cosmetics">💄 Cosmetics & Beauty</option>
                    <option value="general">📦 General Inventory</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block">Badge Theme Color</label>
                  <select
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium text-gray-700 cursor-pointer"
                  >
                    {COLOR_OPTIONS.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Description</label>
                <textarea
                  rows={2}
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium"
                />
              </div>

              {/* Subcategories Editor within Edit Category Modal */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-indigo-600" />
                    Subcategories ({initialSubList.length})
                  </label>
                  <span className="text-[10px] text-slate-500">Manage attached subcategories</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add subcategory (e.g. Tablets, Injections, Syrup)..."
                    value={newSubTagInput}
                    onChange={(e) => setNewSubTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddInitialSubTag();
                      }
                    }}
                    className="flex-1 bg-white border border-slate-300 p-2 rounded-lg outline-none text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleAddInitialSubTag}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-lg text-xs cursor-pointer shadow-2xs"
                  >
                    + Add
                  </button>
                </div>

                {initialSubList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-32 overflow-y-auto">
                    {initialSubList.map((tag, idx) => (
                      <span
                        key={tag.id || idx}
                        className="bg-white border border-slate-300 text-slate-800 font-medium px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 shadow-2xs"
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveSubTag(idx)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer p-0.5"
                          title="Remove subcategory"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">No subcategories currently attached.</p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Automatic Sync:</strong> Updating this category will automatically update all assigned medicines in inventory and commit to the database.
                </p>
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="bg-white border border-gray-300 py-2 px-4 rounded-lg text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveCategory(e, false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold py-2 px-3 rounded-lg text-xs cursor-pointer"
                  title="Stage changes for Batch Save Once"
                >
                  Stage Changes
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !catName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving to Database...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
                      Save to Database
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Subcategory */}
      {activeCategoryForSub && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Add Subcategory</h3>
                  <p className="text-[11px] text-gray-500">Under: <span className="font-bold text-indigo-700">{activeCategoryForSub.name}</span></p>
                </div>
              </div>
              <button
                onClick={() => setActiveCategoryForSub(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubcategory} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Subcategory Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oral Capsules, Suspensions, Ointments"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none focus:border-indigo-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Dosage form or sub-classification details..."
                  value={subDescription}
                  onChange={(e) => setSubDescription(e.target.value)}
                  className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium"
                />
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setActiveCategoryForSub(null)}
                  className="bg-white border border-gray-300 py-2 px-4 rounded-lg text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubSubmitting || !subName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubSubmitting ? 'Adding...' : 'Add Subcategory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Subcategory */}
      {editingSubcategory && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Edit Subcategory</h3>
                  <p className="text-[11px] text-gray-500">Update subcategory specifications</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSubcategory(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubcategory} className="space-y-4">
              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Subcategory Name *</label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none focus:border-blue-600 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-gray-700 block">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={subDescription}
                  onChange={(e) => setSubDescription(e.target.value)}
                  className="w-full bg-white border border-gray-300 p-2.5 rounded-lg outline-none font-medium"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-900 text-[11px]">
                <strong>Sync Notice:</strong> Renaming this subcategory will cascade updates to all products currently categorized under it.
              </div>

              <div className="pt-3 border-t flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingSubcategory(null)}
                  className="bg-white border border-gray-300 py-2 px-4 rounded-lg text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubSubmitting || !subName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubSubmitting ? 'Updating...' : 'Save Subcategory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Category Confirmation */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Category?</h3>
                <p className="text-[11px] text-gray-500">Category: <span className="font-bold text-rose-700">{deletingCategory.name}</span></p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete this category? There are currently <strong className="text-slate-900 font-mono">{getProductCountForCategory(deletingCategory.name)} products</strong> cataloged under this category.
            </p>

            <div className="pt-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="bg-white border border-gray-300 py-2 px-4 rounded-lg text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={isSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Subcategory Confirmation */}
      {deletingSubcategory && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-150 text-xs text-gray-800 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Delete Subcategory?</h3>
                <p className="text-[11px] text-gray-500">Subcategory: <span className="font-bold text-rose-700">{deletingSubcategory.sub.name}</span></p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to delete the subcategory <strong>"{deletingSubcategory.sub.name}"</strong>?
            </p>

            <div className="pt-2 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingSubcategory(null)}
                className="bg-white border border-gray-300 py-2 px-4 rounded-lg text-gray-700 font-bold hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubcategory}
                disabled={isSubSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-5 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { CategoryManagerPanel };
