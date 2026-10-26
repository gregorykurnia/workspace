// Test accounts and sample data for emulator runs (plan 1.3, spec §C). Emulator only: the password is public.
export const PROJECT = 'demo-workspace';
export const PASSWORD = 'emulator-pass-1';
export const ADMIN = { uid: 'emu-admin', email: 'admin@example.test', name: 'Emu Admin', role: 'admin' };
export const MEMBER = { uid: 'emu-member', email: 'member@example.test', name: 'Emu Member', role: 'member' };
// Signs in fine, but is not on the approved list and has no users/ record.
export const STRANGER = { uid: 'emu-stranger', email: 'stranger@example.test', name: 'Emu Stranger' };

const NOW = Date.UTC(2026, 0, 5, 9, 0, 0);
export const AREA = { id: 'emu-area', name: 'Seeded area', icon: '', created: NOW, privateTo: null };
export const AREA2 = { id: 'emu-area-2', name: 'Seeded second area', icon: '', created: NOW + 1, privateTo: null };
export const MOM = { id: 'emu-mom', folderId: AREA.id, title: 'Seeded meeting', date: NOW, privateTo: null };
export const FILE = { id: 'emu-file', folderId: AREA.id, name: 'Seeded link', type: 'link', url: 'https://example.com/', note: '', added: NOW, privateTo: null };
// For tests/private-areas.spec.js (plan 2.4): two areas of its own, so it doesn't disturb the other specs' data.
export const AREA_P = { id: 'emu-area-p', name: 'Private test area', icon: '', created: NOW + 2, privateTo: null };
export const AREA_O = { id: 'emu-area-o', name: 'Open test area', icon: '', created: NOW + 3, privateTo: null };
export const MOM_P = { id: 'emu-mom-p', folderId: AREA_P.id, title: 'Plan for the private area', date: NOW, privateTo: null };
export const MOM_O = { id: 'emu-mom-o', folderId: AREA_O.id, title: 'Notes from the open area', date: NOW, privateTo: null };
// The member sees only areas an admin granted (folder_access); every seeded area is granted.
export const ACCESS = [AREA, AREA2, AREA_P, AREA_O].map((a, i) => ({ id: `emu-access-${i + 1}`, folderId: a.id, uid: MEMBER.uid, email: MEMBER.email, displayName: MEMBER.name }));
