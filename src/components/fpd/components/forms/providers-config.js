import {
  LuZap,
  LuDroplet,
  LuRadio,
  LuBuilding2,
  LuClipboardList,
} from 'react-icons/lu';

export const PROVIDER_CATEGORIES = [
  { value: 'electricity', label: 'Electricity', color: 'yellow', icon: LuZap },
  { value: 'water', label: 'Water', color: 'blue', icon: LuDroplet },
  { value: 'communications', label: 'Communications/Internet', color: 'purple', icon: LuRadio },
  { value: 'rental', label: 'Rental/Property', color: 'indigo', icon: LuBuilding2 },
  { value: 'other', label: 'Other Services', color: 'gray', icon: LuClipboardList },
];

export const getCategoryIcon = (category) => {
  const cat = PROVIDER_CATEGORIES.find((c) => c.value === category);
  return cat ? cat.icon : LuClipboardList;
};

export const getCategoryLabel = (category) => {
  const cat = PROVIDER_CATEGORIES.find((c) => c.value === category);
  return cat ? cat.label : category;
};

export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  const digitsOnly = String(phone).replace(/\D/g, '');
  if (digitsOnly.length <= 5) return digitsOnly;
  if (digitsOnly.length === 11 && digitsOnly.startsWith('09')) {
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  if (digitsOnly.length === 12 && digitsOnly.startsWith('639')) {
    return `+${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 5)}-${digitsOnly.slice(5, 8)}-${digitsOnly.slice(8)}`;
  }
  return String(phone);
};
