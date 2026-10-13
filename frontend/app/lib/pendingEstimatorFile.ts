const DATABASE_NAME = "shop-estimator";
const STORE_NAME = "pending-files";
const FILE_KEY = "estimator-upload";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Nu pot pregăti transferul fișierului."));
  });
}

export async function savePendingEstimatorFile(file: File): Promise<void> {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(file, FILE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Fișierul nu a putut fi pregătit pentru estimator."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Transferul fișierului a fost întrerupt."));
    });
  } finally {
    database.close();
  }
}

export async function takePendingEstimatorFile(): Promise<File | null> {
  const database = await openDatabase();

  try {
    return await new Promise<File | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(FILE_KEY);
      let file: File | null = null;

      request.onsuccess = () => {
        file = request.result instanceof File ? request.result : null;
        store.delete(FILE_KEY);
      };
      request.onerror = () => reject(request.error ?? new Error("Fișierul transferat nu a putut fi citit."));
      transaction.oncomplete = () => resolve(file);
      transaction.onerror = () => reject(transaction.error ?? new Error("Fișierul transferat nu a putut fi citit."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Citirea fișierului transferat a fost întreruptă."));
    });
  } finally {
    database.close();
  }
}
