import { useEffect, useState } from 'react';
import { Search, Trash2, UserX, UsersRound } from 'lucide-react';
import Button from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { PageHeader, Pagination } from '../../components/ui/Display';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useApi } from '../../hooks/useApi';
import { useDebouncedValue, useDocumentTitle } from '../../hooks/misc';
import { formatShortDate, plural } from '../../utils/format';
import Avatar from '../../components/ui/Avatar';

const PAGE_SIZE = 20;
const ROLE_OPTIONS = [
  { value: '', label: 'All accounts' },
  { value: 'user', label: 'Readers' },
  { value: 'admin', label: 'Administrators' },
];

export default function AdminUsersPage() {
  useDocumentTitle('Readers');
  const { user: me } = useAuth();
  const toast = useToast();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebouncedValue(searchInput.trim());
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search, role]);

  const users = useApi(
    (signal) => adminApi.users({ search, role, page, limit: PAGE_SIZE }, signal),
    [search, role, page]
  );

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const { message } = await adminApi.deleteUser(toDelete.id);
      toast.success(message, 'Account deleted');
      const lastOnPage = users.data?.users.length === 1;
      setToDelete(null);
      if (lastOnPage && page > 1) setPage(page - 1);
      else users.reload();
    } catch (error) {
      toast.error(error.message);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const total = users.data?.pagination.total ?? 0;
  const filtered = Boolean(search || role);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Readers"
        description="Everyone with a BookTracker account. Deleting a reader also removes their library and reading progress."
      />

      <div className="filters filters--two" role="search">
        <div className="filters__search field__control">
          <label htmlFor="user-search" className="visually-hidden">
            Search by name or email
          </label>
          <Search className="input-icon" aria-hidden="true" />
          <input
            id="user-search"
            type="search"
            className="input input--with-icon"
            placeholder="Search by name or email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="user-role" className="visually-hidden">
            Account type
          </label>
          <select id="user-role" className="select" value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {users.loading && !users.data ? (
        <LoadingState label="Fetching accounts…" />
      ) : users.error && !users.data ? (
        <ErrorState title="Accounts could not be loaded" error={users.error} onRetry={users.reload} />
      ) : total === 0 ? (
        <EmptyState
          icon={filtered ? UserX : UsersRound}
          title={filtered ? 'No account matches your search' : 'No accounts yet'}
          text={filtered ? 'Try another name or email.' : 'Readers appear here once they create an account.'}
        >
          {filtered && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearchInput('');
                setRole('');
              }}
            >
              Clear filters
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className={users.loading ? 'is-refreshing' : ''} aria-busy={users.loading}>
          <p className="results-summary" aria-live="polite">
            {plural(total, 'account')}
            {search && ` matching “${search}”`}
          </p>
          <div className="panel">
            <table className="table card-table user-table">
              <thead>
                <tr>
                  <th scope="col">Account</th>
                  <th scope="col">Role</th>
                  <th scope="col">Email</th>
                  <th scope="col" className="num">
                    Books
                  </th>
                  <th scope="col">Joined</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.users.map((account) => {
                  const isMe = account.id === me?.id;
                  return (
                    <tr key={account.id}>
                      <td className="card-table__main user-table__account">
                        <Avatar name={account.name} url={account.avatarUrl} />
                        <span className="user-table__text">
                          <span className="user-table__name">
                            {account.name}
                            {isMe && <span className="muted"> (you)</span>}
                          </span>
                          <span className="user-table__email">{account.email}</span>
                        </span>
                      </td>
                      <td data-label="Role">
                        <span className={`badge ${account.role === 'admin' ? 'badge--gold' : ''}`}>
                          {account.role === 'admin' ? 'Administrator' : 'Reader'}
                        </span>
                      </td>
                      <td data-label="Email">
                        <span className={`badge ${account.isVerified ? '' : 'badge--muted'}`}>
                          {account.isVerified ? 'Verified' : 'Not verified'}
                        </span>
                      </td>
                      <td data-label="Books" className="num">
                        {account.libraryCount}
                      </td>
                      <td data-label="Joined" className="tabular">
                        {formatShortDate(account.createdAt)}
                      </td>
                      <td className="card-table__actions user-table__actions">
                        {account.role === 'user' ? (
                          <Button
                            variant="danger-ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => setToDelete(account)}
                            aria-label={`Delete ${account.name}'s account`}
                          >
                            Delete
                          </Button>
                        ) : (
                          <span className="muted user-table__note">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={users.data.pagination.page} totalPages={users.data.pagination.totalPages} onChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this account?"
        confirmLabel="Delete account"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      >
        <strong>{toDelete?.name}</strong> ({toDelete?.email}) will be deleted permanently
        {toDelete?.libraryCount
          ? `, together with the ${plural(toDelete.libraryCount, 'book')} on their shelves and their reading progress`
          : ''}
        . They will be signed out and will need to register again to use BookTracker. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
