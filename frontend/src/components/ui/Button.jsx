// Pass `as={Link}` (with `to`) to render a router link styled as a button.
export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size,
  block = false,
  loading = false,
  icon: Icon,
  iconAfter: IconAfter,
  className = '',
  disabled,
  type,
  children,
  ...rest
}) {
  const classes = ['btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', className]
    .filter(Boolean)
    .join(' ');
  const buttonProps = Component === 'button' ? { type: type || 'button', disabled: disabled || loading } : {};

  return (
    <Component className={classes} aria-busy={loading || undefined} {...buttonProps} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : Icon && <Icon aria-hidden="true" />}
      {children && <span>{children}</span>}
      {IconAfter && !loading && <IconAfter aria-hidden="true" />}
    </Component>
  );
}
