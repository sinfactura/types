declare global {
  /** Write shape for brand create/update — carries the transient photo controls. */
  type BrandUpsertInput = Partial<Brand> & PhotoUploadControls;

  interface Brand {
    storeId: string;
    brandId: string;
    name: string;
    photoURL?: string;
    /** @deprecated Request-only upload control, never persisted or returned — use `BrandUpsertInput.photoData`. */
    photoData?: string;
    /** @deprecated Request-only control, never persisted or returned — use `BrandUpsertInput.removePhotoURL`. */
    removePhotoURL?: string;
    isFather: boolean;
    father?: string;
    disabled: boolean;
  }
}

export {}; // NOSONAR