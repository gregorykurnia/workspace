/* Mock data. Reused from the directions (B's areas, meetings, journal), plus
   cases the inventory needs: restricted, final, deleted, shared, members. */
'use strict';

const TODAY_ISO = '2026-10-13';
const TODAY = new Date(2026, 9, 13);
const SHARE_PASSWORD = 'meridian';   // demo password for every restricted item

function svgThumb(bg, a, b, shape) {
  const body = shape === 'bars'
    ? `<rect x="90" y="150" width="60" height="260" rx="10" fill="${a}"/><rect x="200" y="100" width="60" height="310" rx="10" fill="${b}"/><rect x="310" y="200" width="60" height="210" rx="10" fill="${a}"/><rect x="420" y="130" width="60" height="280" rx="10" fill="${b}"/>`
    : shape === 'box'
      ? `<rect x="180" y="150" width="240" height="220" rx="16" fill="${a}"/><rect x="220" y="190" width="160" height="30" rx="8" fill="${b}"/><rect x="220" y="240" width="110" height="20" rx="8" fill="${b}" opacity=".6"/>`
      : `<circle cx="400" cy="250" r="120" fill="${a}"/><circle cx="330" cy="200" r="60" fill="${b}"/><path d="M200 420 L400 300 L600 420Z" fill="${b}" opacity=".7"/>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="${bg}"/>${body}</svg>`);
}

const KINDS = {
  pdf: { label: 'PDF', icon: 'pdf', ext: 'PDF', tile: 'k-pdf' },
  image: { label: 'Image', icon: 'image', ext: 'IMG', tile: 'k-image' },
  video: { label: 'Video', icon: 'video', ext: 'MP4', tile: 'k-video' },
  sheet: { label: 'Spreadsheet', icon: 'sheet', ext: 'XLSX', tile: 'k-sheet' },
  slides: { label: 'Presentation', icon: 'slides', ext: 'SLIDES', tile: 'k-slides' },
  link: { label: 'Web link', icon: 'globe', ext: 'LINK', tile: 'k-link' },
  other: { label: 'Other', icon: 'doc', ext: 'FILE', tile: 'k-other' },
};
const LINK_KINDS = ['link', 'slides', 'pdf', 'sheet', 'image', 'other'];

const SEED = {
  me: { id: 'greg', name: 'Greg Kurnia', ini: 'GK', email: 'greg@studio.example' },
  // The member persona used when the role switch is "member".
  members: [
    { id: 'priya', name: 'Priya Nair', ini: 'PN', cls: 'c' },
    { id: 'ana', name: 'Ana Ruiz', ini: 'AR', cls: 'b' },
    { id: 'sam', name: 'Sam Lee', ini: 'SL', cls: 'd' },
  ],
  areas: [
    { id: 'clients', name: 'Clients', emoji: '🏢', parent: null, created: '2026-01-08', tint: 'tint-peach' },
    { id: 'verdant', name: 'Verdant Foods', emoji: '🌿', parent: 'clients', created: '2026-06-02', tint: 'tint-mint' },
    { id: 'packaging', name: 'Packaging rollout', emoji: '📦', parent: 'verdant', created: '2026-07-14', tint: 'tint-sun' },
    { id: 'q4', name: 'Q4 review', emoji: '📈', parent: 'verdant', created: '2026-09-21', tint: 'tint-sky' },
    { id: 'harbor', name: 'Harbor Logistics', emoji: '⚓', parent: 'clients', created: '2026-08-30', tint: 'tint-sky' },
    { id: 'meridian', name: 'Meridian Health', emoji: '🏥', parent: 'clients', created: '2026-05-11', tint: 'tint-rose', restricted: true },
    { id: 'sales', name: 'Sales pipeline', emoji: '🎯', parent: null, created: '2026-01-08', tint: 'tint-sky' },
    { id: 'team', name: 'Team', emoji: '👥', parent: null, created: '2026-01-08', tint: 'tint-lilac' },
    { id: 'weekly', name: 'Weekly sync', emoji: '🗓️', parent: 'team', created: '2026-01-12', tint: 'tint-lilac' },
    { id: 'initiatives', name: 'Initiatives', emoji: '💡', parent: null, created: '2026-02-02', tint: 'tint-sun' },
    { id: 'website', name: 'Website relaunch', emoji: '🚀', parent: 'initiatives', created: '2026-08-04', tint: 'tint-rose' },
  ],
  groups: [
    { id: 'g-steer', area: 'verdant', kind: 'mom', name: 'Steering committee' },
    { id: 'g-work', area: 'verdant', kind: 'mom', name: 'Workshops' },
    { id: 'g-contracts', area: 'verdant', kind: 'file', name: 'Contracts' },
    { id: 'g-brand', area: 'verdant', kind: 'file', name: 'Brand assets' },
    { id: 'g-harbor', area: 'harbor', kind: 'file', name: 'Site material' },
  ],
  moms: [
    { id: 'm1', title: 'Steering committee #7', date: '2026-10-12', tags: ['steering', 'budget'], area: 'verdant', group: 'g-steer', flagged: true,
      doc: { label: 'SC #7 shared notes', url: 'docs.google.com/document/d/verdant-sc7' },
      body: '<p>Quarterly steering with Verdant’s leadership. Focus on the phase 2 packaging budget and the launch window.</p>' +
        '<h2>Decisions</h2><ul><li>Approve the phase 2 packaging budget of €180k</li><li>Move launch to week 46 to line up with the retail reset</li><li>Ana owns the supplier shortlist going forward</li></ul>' +
        '<h2>Discussion</h2><p>Ana walked through the three supplier quotes. Rotterdam is cheapest but has the longest lead time; the team prefers a split order so the first stores aren’t blocked.</p>' +
        '<h2>Actions</h2><table><tbody><tr><th>Action</th><th>Owner</th><th>Due</th></tr><tr><td>Send revised timeline to retail partners</td><td>Greg</td><td>16 Oct</td></tr><tr><td>Confirm split order with Rotterdam</td><td>Ana Ruiz</td><td>20 Oct</td></tr><tr><td>Draft shelf-talker copy</td><td>Priya</td><td>23 Oct</td></tr></tbody></table>' +
        '<p>Next meeting: 26 Oct, same room.</p>' },
    { id: 'm2', title: 'Steering committee #6', date: '2026-09-28', tags: ['steering'], area: 'verdant', group: 'g-steer', final: true,
      body: '<p>Reviewed phase 1 results and agreed to scope phase 2.</p><h2>Notes</h2><ul><li>Phase 1 landed on time in 42 stores</li><li>Retail feedback is positive on the new tray</li></ul>' },
    { id: 'm3', title: 'Packaging workshop – day 2', date: '2026-10-09', tags: ['workshop', 'design'], area: 'verdant', group: 'g-work',
      body: '<p>Second day with the design team. We narrowed the shelf concepts down to two and tested them with three store managers.</p>' },
    { id: 'm4', title: 'Kick-off with Verdant', date: '2026-06-02', tags: ['kick-off'], area: 'verdant', group: null, legacy: true,
      body: '<div align="center"><font size="5" color="#1D5FB8"><b>Kick-off with Verdant</b></font></div><br><font face="Verdana">First meeting with the Verdant team. Goals, people, and how we’ll work together.</font><br><center><font size="2">Recorded before the current editor existed</font></center>' },
    { id: 'm5', title: 'Supplier call – Rotterdam', date: '2026-10-06', tags: ['supply'], area: 'verdant', group: null,
      body: '<p>Lead times, minimum order quantities, and the option of a split delivery.</p>' },
    { id: 'm6', title: 'Team sync – week 41', date: '2026-10-12', tags: ['team'], area: 'weekly', group: null,
      body: '<p>Round-the-table updates, hiring, and the website relaunch timeline.</p><ul><li>Website copy freeze moves to 24 Oct</li><li>Two interviews booked for the designer role</li></ul>' },
    { id: 'm7', title: 'Discovery call', date: '2026-09-30', tags: ['discovery'], area: 'harbor', group: null,
      body: '<p>Harbor wants to simplify their warehouse signage across five sites.</p>' },
    { id: 'm8', title: 'Clinical ops intro', date: '2026-09-15', tags: ['intro'], area: 'meridian', group: null,
      body: '<p>Confidential introduction with the clinical operations team.</p>' },
    { id: 'm9', title: 'Launch readiness – 2024', date: '2024-11-20', tags: ['launch'], area: 'q4', group: null, legacy: true,
      body: '<font size="4"><b>Launch readiness</b></font><br><font color="#444">Checklist reviewed. Two items open: retail sign-off and artwork proof.</font><div>Owner: <u>Priya</u></div>' },
    { id: 'm10', title: 'Website copy review', date: '2026-10-07', tags: ['website'], area: 'website', group: null,
      body: '<p>Copy review for the homepage. Tone is right; the pricing page needs a clearer comparison table.</p>' },
    { id: 'pj', title: 'Prospect Journal 2026', date: '2026-01-08', edited: '2026-10-12', tags: ['pipeline', 'journal'], area: 'sales', group: null, flagged: true, journal: true, body: '' },
  ],
  files: [
    { id: 'f1', name: 'Master services agreement.pdf', kind: 'pdf', size: 2.4e6, date: '2026-10-03', area: 'verdant', group: 'g-contracts', note: 'Signed by both parties', final: true },
    { id: 'f2', name: 'SOW – Packaging phase 2.pdf', kind: 'pdf', size: 860e3, date: '2026-10-08', area: 'verdant', group: 'g-contracts', note: 'Draft for legal review' },
    { id: 'f3', name: 'Logo pack – final.png', kind: 'image', size: 1.2e6, date: '2026-09-18', area: 'verdant', group: 'g-brand', flagged: true, thumb: svgThumb('#EEF6F0', '#2E9E63', '#BDE5CC', 'circle'), note: 'Approved logo set' },
    { id: 'f4', name: 'Shelf mock-up.jpg', kind: 'image', size: 3.1e6, date: '2026-10-12', area: 'verdant', group: 'g-brand', thumb: svgThumb('#FFF5EA', '#E9A25A', '#F6D2A8', 'box'), note: '' },
    { id: 'f5', name: 'Packaging timeline.xlsx', kind: 'sheet', size: 240e3, date: '2026-10-10', area: 'verdant', group: null, note: 'Weekly milestones to launch' },
    { id: 'f6', name: 'Kick-off deck', kind: 'slides', link: 'docs.google.com/presentation/d/verdant-kickoff', date: '2026-06-02', area: 'verdant', group: null, note: 'Shared by Verdant' },
    { id: 'f7', name: 'Factory walkthrough.mp4', kind: 'video', size: 84e6, date: '2026-09-25', area: 'verdant', group: null, note: 'Filmed on the Rotterdam visit' },
    { id: 'f8', name: 'Verdant brand site', kind: 'link', link: 'verdantfoods.example', date: '2026-06-03', area: 'verdant', group: null, note: '' },
    { id: 'f9', name: 'Pricing bands – confidential.xlsx', kind: 'sheet', size: 118e3, date: '2026-10-05', area: 'verdant', group: null, restricted: true, note: 'Discount bands by volume tier' },
    { id: 'f10', name: 'Harbor site plan.png', kind: 'image', size: 2.2e6, date: '2026-09-30', area: 'harbor', group: 'g-harbor', thumb: svgThumb('#EEF3FB', '#5B7DB8', '#C6D5EE', 'bars'), note: 'Five-site layout' },
    { id: 'f11', name: 'Website wireframes.pdf', kind: 'pdf', size: 4.8e6, date: '2026-10-02', area: 'website', group: null, note: 'Homepage and pricing' },
    { id: 'f12', name: 'Consent forms.pdf', kind: 'pdf', size: 540e3, date: '2026-09-16', area: 'meridian', group: null, note: 'Template for trial sites' },
  ],
  // Deleted items keep a snapshot so restore puts them back exactly.
  deleted: [
    { key: 'd1', t: 'mom', name: 'Old agenda draft', at: '2026-10-12', snap: { moms: [{ id: 'old1', title: 'Old agenda draft', date: '2026-10-01', tags: [], area: 'verdant', group: null, body: '<p>Draft agenda, superseded.</p>' }] } },
    { key: 'd2', t: 'file', name: 'Old logo v1.png', at: '2026-10-09', snap: { files: [{ id: 'old2', name: 'Old logo v1.png', kind: 'image', size: 600e3, date: '2026-08-02', area: 'verdant', group: null, thumb: svgThumb('#F3F3F3', '#999', '#DDD', 'circle'), note: '' }] } },
    { key: 'd3', t: 'group', name: 'Archive', at: '2026-10-07', snap: { groups: [{ id: 'g-old', area: 'verdant', kind: 'mom', name: 'Archive' }] } },
    { key: 'd4', t: 'area', name: 'Pilot 2025', at: '2026-10-06', snap: { areas: [{ id: 'pilot', name: 'Pilot 2025', emoji: '🧪', parent: null, created: '2025-03-04', tint: 'tint-mint' }], moms: [{ id: 'pilot-1', title: 'Pilot kick-off', date: '2025-03-04', tags: ['pilot'], area: 'pilot', group: null, body: '<p>Pilot kick-off notes.</p>' }], files: [], groups: [] } },
    { key: 'd5', t: 'mom', name: 'Expired draft', at: '2026-10-04', snap: { moms: [{ id: 'old3', title: 'Expired draft', date: '2026-09-01', tags: [], area: 'sales', group: null, body: '' }] } },
  ],
  // Link sharing per item. true = a link is on.
  shares: { 'a:verdant': true, 'a:initiatives': false, 'm:m2': true, 'm:m1': false, 'f:f3': true, 'f:f9': true },
  // Which members can see which area (and everything inside it).
  access: { verdant: ['priya'], weekly: ['priya'], harbor: ['ana'] },
  // Recently added across the workspace (F4b): what, where, when, by whom.
  activity: [
    { t: 'file', id: 'f4', who: 'Ana Ruiz', ini: 'AR', cls: 'b', when: '2 h ago' },
    { t: 'mom', id: 'm6', who: 'Priya Nair', ini: 'PN', cls: 'c', when: 'Yesterday' },
    { t: 'mom', id: 'm1', who: 'You', ini: 'GK', cls: 'e', when: 'Yesterday' },
    { t: 'file', id: 'f5', who: 'Sam Lee', ini: 'SL', cls: 'd', when: '3 days ago' },
  ],
  recent: [['m', 'm1'], ['m', 'pj'], ['f', 'f5'], ['m', 'm6']],
  journal: [
    ['Northwind Bakery', 'Ana Ruiz', 'Proposal sent', 'Follow up 16 Oct', 'Ana loved the packaging case study and asked for a phased proposal covering their three regional bakeries. Budget sign-off sits with their CFO, who joins the follow-up call. They’re comparing us with one local agency, mainly on price. Lead with the rollout timeline and the savings from consolidated print runs.'],
    ['Bluepeak Outdoor', 'Sam Lee', 'Discovery', 'Book workshop', 'Warm intro through Sam’s former colleague at Verdant. They’re relaunching their outdoor range in spring and want help shaping the in-store experience. No budget confirmed yet, but the timing is tight. Propose a half-day discovery workshop at their Utrecht office.'],
    ['Cobalt Pharma', 'Dr. Iris Chen', 'Negotiation', 'Legal review', 'Scope agreed in principle: a 12-week programme across two product lines. Their legal team flagged the liability clause and the data-processing addendum. Iris is supportive and pushing internally for a November start. Keep pricing as quoted; offer flexibility on the payment schedule instead.'],
    ['Fernhill Hotels', 'Tom Okafor', 'Cold', 'Send case study', 'Not ready yet. Revisit after their Q1 planning.'],
    ['Lumen Studio', 'Priya Nair', 'Won', 'Kick-off 20 Oct', 'Signed on 9 Oct. Priya wants a light-touch kick-off with the two founders and the studio lead. They value quick iterations over heavy documentation, so keep weekly check-ins short. First deliverable: a brand audit by mid-November.'],
  ],
};

/* Working copy. Scenarios reset it from SEED, so the prototype never drifts. */
let DB = structuredClone(SEED);
