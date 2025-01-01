declare global {
    interface Brand {
        storeId: string;
        brandId: string;
        name: string;
        photoURL?: string;
        photoData?: string;
        removePhotoURL?: string;
        isFather: boolean;
        father?: string;
        disabled: boolean;
    }
}
export {};
