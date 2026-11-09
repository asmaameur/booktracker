import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../ui/Modal';
import { booksApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { plural } from '../../utils/format';

// Deleting a book that readers have shelved needs a second, explicit
// confirmation: their entries and saved pages are removed with it.
export default function DeleteBookDialog({ book, readerCount = null, onClose, onDeleted }) {
  const toast = useToast();
  const [count, setCount] = useState(readerCount);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setCount(readerCount);
  }, [book?.id, readerCount]);

  const inLibraries = count > 0;

  const confirm = async () => {
    setDeleting(true);
    try {
      const { message } = await booksApi.remove(book.id, { force: inLibraries });
      toast.success(message, 'Book deleted');
      onDeleted(book);
    } catch (error) {
      if (error.code === 'BOOK_IN_LIBRARIES') {
        setCount(error.data?.readerCount ?? 1);
      } else {
        toast.error(error.message);
        onClose();
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(book)}
      title={inLibraries ? 'Readers have this book' : 'Delete this book?'}
      confirmLabel={inLibraries ? 'Delete anyway' : 'Delete book'}
      loading={deleting}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {inLibraries ? (
        <>
          “{book?.title}” is on the shelves of {plural(count, 'reader')}. Deleting it also removes it from their
          libraries, together with their reading progress. This cannot be undone.
        </>
      ) : (
        <>“{book?.title}” will be removed from the catalogue permanently. This cannot be undone.</>
      )}
    </ConfirmDialog>
  );
}
