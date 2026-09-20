# Mobile PWA Optimization Prompt

Please improve this web app so it works as a fully responsive, mobile-first Progressive Web App (PWA).

The app currently works well on desktop, but the mobile experience needs significant improvement. Please inspect the existing codebase first and then implement the following without breaking the current desktop layout or functionality.

## Main goals

### 1. Convert the app into a proper PWA

- Add a valid web app manifest.
- Add service-worker support for caching the app shell and enabling basic offline functionality.
- Make the app installable on supported mobile and desktop browsers.
- Add appropriate app icons, theme colors, splash-screen behavior, and viewport settings.
- Ensure the app opens and behaves like a standalone mobile application when installed.
- Show a clear update flow when a new version is available.

### 2. Make the entire UI mobile optimized

- Use responsive layouts instead of simply shrinking the desktop layout.
- Optimize all pages for phone screen sizes, including approximately 320px, 375px, 390px, and 430px widths.
- Ensure there is no unnecessary horizontal scrolling.
- Make buttons, inputs, menus, and interactive elements easy to use with touch.
- Use touch targets of at least 44px where practical.
- Respect mobile safe-area insets for devices with notches and home indicators.
- Ensure forms and inputs work properly when the mobile keyboard opens.
- Improve spacing, typography, navigation, dialogs, dropdowns, tables, cards, and sidebars for mobile.
- Preserve the existing desktop experience and make sure the layout still works on tablets and larger screens.
- Add responsive breakpoints only where they are actually needed.

### 3. Improve the document editor on mobile

Currently, when creating or editing a document, the formatting toolbar containing controls such as bold, italic, underline, alignment, lists, and other actions scrolls away.

Fix this by making the editor toolbar sticky on mobile:

- Keep the formatting toolbar visible at the top while scrolling through the document.
- Account for the mobile header or navigation bar so the toolbar does not overlap other UI.
- Ensure the toolbar has a solid background and a visible separation from the document content.
- Make the toolbar horizontally scrollable or collapsible if all controls cannot fit on a small screen.
- Keep the most important actions easily accessible.
- Ensure the toolbar does not cover the text cursor, selected text, or document content.
- Make sure the toolbar behaves correctly with the on-screen keyboard.
- Preserve the current desktop toolbar behavior unless a desktop improvement is necessary.
- Ensure sticky positioning works correctly inside the editor’s scroll container.

### 4. Mobile interaction and performance

- Avoid layouts that jump while loading.
- Optimize scrolling and animations for touch devices.
- Prevent accidental text selection or button presses where appropriate.
- Make menus and popovers usable with one hand.
- Ensure the app remains fast on slower mobile connections and devices.
- Do not remove existing functionality just to make the layout fit.

### 5. Testing and verification

Test the implementation at minimum on:

- 320px mobile width
- 375px mobile width
- 390px mobile width
- 430px mobile width
- Tablet width
- Desktop width

Verify that:

- The app is installable as a PWA.
- The app loads correctly when offline after the initial visit.
- The formatting toolbar remains sticky while scrolling through a document on mobile.
- The toolbar does not overlap or hide content.
- The mobile keyboard does not break the editor layout.
- All existing document-editing functionality still works.
- There is no unexpected horizontal overflow.
- Desktop layouts and functionality remain intact.

Before making changes, identify the current framework, routing structure, editor implementation, styling system, and existing PWA support. Then implement the changes using the project’s existing conventions. Avoid replacing the entire UI or introducing unnecessary dependencies. At the end, summarize the files changed, the mobile improvements made, and any remaining limitations.

Please make these changes directly in the existing project. Do not only provide suggestions or mockups. Inspect the current implementation first, then modify the code and verify the result.
