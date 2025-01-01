declare global {
  interface Category {
    storeId: string;
    categoryId: string;
    name: string;
    photoURL?: string;
    photoData?: string;
    removePhotoURL?: string;
    isFather?: boolean;
    father?: number;
    disabled?: boolean;
    isNew?: boolean;
  }
}

export {};
