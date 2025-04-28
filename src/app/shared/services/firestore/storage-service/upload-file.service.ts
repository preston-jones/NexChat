import { Injectable } from '@angular/core';
import { getDownloadURL, getStorage, ref, uploadBytes } from '@angular/fire/storage';

@Injectable({
  providedIn: 'root'
})
export class UploadFileService {

  constructor() { }

  async uploadFileWithIds(file: File, userId: string, messageId: string): Promise<string> {
    const storage = getStorage();

    // Stelle sicher, dass der Dateiname existiert und hole die Dateiendung
    const fileName = file.name;
    const fileType = fileName.split('.').pop(); // Dateityp extrahieren

    if (!fileType) {
      console.error('Dateityp konnte nicht ermittelt werden');
      throw new Error('Dateityp konnte nicht ermittelt werden'); // Fehler werfen, wenn der Dateityp nicht ermittelt werden kann
    }

    let folder = '';

    if (['png', 'jpeg', 'jpg', 'gif', 'bmp'].includes(fileType)) {
      folder = `images/${messageId}/${userId}`;
    } else if (['pdf'].includes(fileType)) {
      folder = `files/${messageId}/${userId}`;
    } else {
      console.error('Dateityp nicht unterstützt');
      throw new Error('Dateityp nicht unterstützt'); // Fehler werfen, wenn der Dateityp nicht unterstützt wird
    }

    const uploadRef = ref(storage, `sended_files/${folder}/${fileName}`); // Verwende fileName

    try {
      // Hochladen
      await uploadBytes(uploadRef, file); // Datei direkt übergeben
      // console.log('Upload erfolgreich!');

      const downloadURL = await getDownloadURL(uploadRef); // Lade die URL nach dem Hochladen ab
      // console.log('Datei verfügbar unter', downloadURL);
      return downloadURL; // Gibt die Download-URL zurück
    } catch (error) {
      console.error('Upload fehlgeschlagen', error);
      throw error; // Fehler weitergeben
    }
  }


  // Utility zum Konvertieren von base64 zu Blob
  dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  async uploadFileWithIdsDirectMessages(file: File, messageId: string): Promise<string> {
    const storage = getStorage();

    // Stelle sicher, dass der Dateiname existiert und hole die Dateiendung
    const fileName = file.name;
    const fileType = fileName.split('.').pop(); // Dateityp extrahieren

    if (!fileType) {
      console.error('Dateityp konnte nicht ermittelt werden');
      throw new Error('Dateityp konnte nicht ermittelt werden'); // Fehler werfen, wenn der Dateityp nicht ermittelt werden kann
    }

    let folder = '';

    if (['png', 'jpeg', 'jpg', 'gif', 'bmp'].includes(fileType)) {
      folder = `images/${messageId}`;
    } else if (['pdf'].includes(fileType)) {
      folder = `files/${messageId}`;
    } else {
      console.error('Dateityp nicht unterstützt');
      throw new Error('Dateityp nicht unterstützt'); // Fehler werfen, wenn der Dateityp nicht unterstützt wird
    }

    const uploadRef = ref(storage, `sended_files/${folder}/${fileName}`); // Verwende fileName

    try {
      // Hochladen
      await uploadBytes(uploadRef, file); // Datei direkt übergeben
      // console.log('Upload erfolgreich!');

      const downloadURL = await getDownloadURL(uploadRef); // Lade die URL nach dem Hochladen ab
      // console.log('Datei verfügbar unter', downloadURL);
      return downloadURL; // Gibt die Download-URL zurück
    } catch (error) {
      console.error('Upload fehlgeschlagen', error);
      throw error; // Fehler weitergeben
    }
  }


  // uploadFile(event: Event, userId: string, messageId: string) {
  //   const fileInput = event.target as HTMLInputElement;
  //   const file = fileInput.files?.[0];
  //   const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/jpg'];
  //   const allowedFileTypes = ['application/pdf'];

  //   if (file) {
  //     const storage = getStorage();
  //     let folder = '';

  //     // Dynamisch den Ordnerpfad abhängig vom Dateityp erstellen
  //     if (allowedImageTypes.includes(file.type)) {
  //       folder = `images/${messageId}/${userId}`; // Backticks für Template-Literals
  //     } else if (allowedFileTypes.includes(file.type)) {
  //       folder = `files/${messageId}/${userId}`;  // Backticks für Template-Literals
  //     } else {
  //       console.error('File type not supported');
  //       return;
  //     }

  //     // Pfad mit messageId und userId erstellen
  //     const uploadRef = ref(storage, `sended_files/${folder}/${file.name}`); // Pfad ohne wiederholte IDs

  //     // Datei hochladen
  //     uploadBytes(uploadRef, file).then(() => {
  //       console.log('Upload successful!');
  //       return getDownloadURL(uploadRef);
  //     }).then((downloadURL) => {
  //       console.log('File available at', downloadURL);
  //       // Hier kannst du den Download-URL verwenden
  //     }).catch((error) => {
  //       console.error('Upload failed', error);
  //     });
  //   }
  // }

}
