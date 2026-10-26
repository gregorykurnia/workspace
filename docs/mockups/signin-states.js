// Approved sign-in mockup (owner, 2026-10-26). Each state returns the .auth card's markup, built with the
// app's own helpers (fieldHTML, inputHTML, btnHTML, noticeHTML, ic, esc). Task 3.1 builds these screens; the
// sample emails are placeholders. Rendered by replacing .auth-wrap's innerHTML on #/signin while signed out.
const states = {
  signin: () => `<form class="auth" novalidate>
      <img class="brand-mark brand-logo" src="icon.svg" alt="">
      <h1>Sign in to ${esc(APP_NAME)}</h1>
      <p class="sub">Enter your email and we’ll send you a link to sign in. No password needed.</p>
      ${fieldHTML({ id: 'sEmail', label: 'Email', control: inputHTML({ id: 'sEmail', name: 'email', type: 'email', placeholder: 'you@company.com', value: 'thania.ferdinanto@deushcs.com' }) })}
      <label class="check-row"><input type="checkbox" checked> Stay signed in on this device</label>
      ${btnHTML({ kind: 'primary', label: 'Send sign-in link', icon: 'mail', type: 'submit' })}
    </form>`,
  sent: () => `<form class="auth" novalidate>
      <span class="brand-mark">${ic('mail')}</span>
      <h1>Check your inbox</h1>
      <p class="sub">We sent a sign-in link to <b>thania.ferdinanto@deushcs.com</b>. Open it on this device and you’re in.</p>
      ${noticeHTML({ tone: 'info', icon: 'info', title: 'Using Workbench from your home screen?', text: 'Copy the link from the email and paste it here instead of tapping it.' })}
      ${fieldHTML({ id: 'sLink', label: 'Sign-in link', control: inputHTML({ id: 'sLink', placeholder: 'Paste the link from your email' }) })}
      ${btnHTML({ kind: 'soft', label: 'Sign in with this link', type: 'submit' })}
      <div class="foot">${btnHTML({ kind: 'link', label: 'Use a different email', icon: 'arrow-left', href: '#' })}${btnHTML({ kind: 'link', label: 'Send it again', href: '#' })}</div>
    </form>`,
  confirm: () => `<form class="auth" novalidate>
      <span class="brand-mark">${ic('mail')}</span>
      <h1>Confirm your email</h1>
      <p class="sub">This link was opened on a different device or browser. Enter the email you asked for it with.</p>
      ${fieldHTML({ id: 'cEmail', label: 'Email', control: inputHTML({ id: 'cEmail', type: 'email', placeholder: 'you@company.com' }) })}
      ${btnHTML({ kind: 'primary', label: 'Sign in', type: 'submit' })}
    </form>`,
  denied: () => `<form class="auth" novalidate>
      <span class="brand-mark">${ic('lock')}</span>
      <h1>This email can’t open the workspace</h1>
      <p class="sub"><b>someone@example.com</b> isn’t on the list of approved emails. Ask the workspace owner to add it.</p>
      <div class="auth-acts">${btnHTML({ kind: 'primary', label: 'Use a different email', icon: 'arrow-left' })}${btnHTML({ kind: 'soft', label: 'Sign out', icon: 'signout' })}</div>
    </form>`,
};
