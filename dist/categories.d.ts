declare global {
    /** Write shape for category create/update — carries the transient photo controls. */
    type CategoryUpsertInput = Partial<Category> & PhotoUploadControls;
    interface Category {
        storeId: string;
        categoryId: string;
        name: string;
        photoURL?: string;
        /** @deprecated Request-only upload control, never persisted or returned — use `CategoryUpsertInput.photoData`. */
        photoData?: string;
        /** @deprecated Request-only control, never persisted or returned — use `CategoryUpsertInput.removePhotoURL`. */
        removePhotoURL?: string;
        isFather: boolean;
        father?: string;
        disabled: boolean;
    }
}
export {};
