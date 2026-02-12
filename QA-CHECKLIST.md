# ✅ QA & Launch Checklist - Undercover

## 📋 Pre-Launch Checklist

### 🔧 Build & Configuration

- [x] Project builds without errors (`npm run build`)
- [x] No TypeScript errors (`npm run typecheck`)
- [x] Production bundle size acceptable (< 600 kB)
- [x] All dependencies up to date
- [x] No console errors in production build
- [ ] Environment variables documented (if any)
- [x] Favicon and app icons configured
- [x] PWA manifest.json configured

### 📱 Mobile Compatibility

- [ ] Tested on iOS Safari (iPhone)
- [ ] Tested on Android Chrome
- [ ] Touch targets minimum 44px
- [ ] No horizontal scroll on mobile
- [ ] Viewport meta tags correct
- [ ] Haptic feedback works (or visual fallback on iOS)
- [ ] Orientation lock works (portrait preferred)
- [ ] Safe area insets respected (notch support)

### 🖥️ Desktop Compatibility

- [ ] Tested on Chrome (latest)
- [ ] Tested on Firefox (latest)
- [ ] Tested on Safari (latest)
- [ ] Tested on Edge (latest)
- [ ] Responsive design works on all screen sizes
- [ ] Keyboard navigation functional
- [ ] Mouse interactions smooth

### 🎨 UI/UX

- [x] Dark mode works correctly
- [x] Light mode works correctly
- [x] Theme toggle persists across sessions
- [x] All animations smooth (60 FPS)
- [x] Loading states present
- [x] Error boundaries catch errors
- [ ] No layout shifts (CLS)
- [ ] Images optimized
- [ ] Fonts load correctly

### 🎮 Game Functionality

#### Lobby
- [ ] Can add 3-20 players
- [ ] Cannot add < 3 or > 20 players
- [ ] Player names validated (not empty)
- [ ] Avatars generate correctly
- [ ] Can remove players
- [ ] Category selection works
- [ ] "Commencer" button disabled when < 3 players

#### Distribution
- [ ] Roles distributed correctly per player count
- [ ] Card flip animation smooth
- [ ] Each player sees their role privately
- [ ] Mr. White sees no word (blur effect)
- [ ] Civils see correct word
- [ ] Undercovers see different word
- [ ] Progress indicator accurate

#### Game Master
- [ ] Timer starts/pauses/resets correctly
- [ ] Timer presets work (30s, 60s, 90s, 120s, 180s)
- [ ] Current speaker displays correctly
- [ ] Next speaker button advances correctly
- [ ] Red alert when timer < 10s
- [ ] Can proceed to voting

#### Vote
- [ ] Sequential voting works
- [ ] Cannot vote for self
- [ ] Vote confirmation modal appears
- [ ] All players must vote
- [ ] Tie detection works
- [ ] Revote for tied candidates
- [ ] Second tie random elimination
- [ ] Progress indicator accurate

#### Elimination
- [ ] Eliminated player role revealed
- [ ] Auto-transition after 3 seconds
- [ ] Correct flow to Mr. White guess if applicable
- [ ] Correct flow to next round otherwise

#### Mr. White Guess
- [ ] Guess input accepts text
- [ ] Player voting works (Accept/Reject)
- [ ] All players must vote
- [ ] Result calculated correctly
- [ ] Transitions to victory if accepted

#### Victory
- [ ] Confetti animation for civil victory
- [ ] Correct winner displayed
- [ ] All player roles revealed
- [ ] Eliminated players marked
- [ ] Reset game button works

### 💾 Data & Persistence

- [x] Game state saves to localStorage
- [x] Game state loads from localStorage
- [x] "Reprendre" button appears when game in progress
- [x] Corrupted localStorage handled gracefully
- [ ] No data loss on page refresh
- [ ] No data loss on browser close/reopen

### 🔒 Security & Privacy

- [ ] No sensitive data in localStorage
- [ ] No external API calls (100% client-side)
- [ ] No tracking/analytics (unless documented)
- [ ] HTTPS enforced in production
- [ ] Content Security Policy configured
- [ ] No XSS vulnerabilities

### ♿ Accessibility

- [ ] Semantic HTML used
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader compatible
- [ ] Alt text on images

### 📊 Performance

- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Lighthouse score > 90
- [ ] No memory leaks
- [ ] Smooth animations (60 FPS)
- [ ] Bundle size optimized

### 🌐 SEO & Meta

- [x] Title tag descriptive
- [x] Meta description present
- [x] Open Graph tags configured
- [x] Twitter Card tags configured
- [x] Canonical URL set
- [x] Language attribute (lang="fr")
- [ ] Sitemap.xml generated
- [ ] Robots.txt configured

### 📚 Documentation

- [x] README.md complete
- [x] GUIDE.md (user guide) complete
- [x] CONTRIBUTING.md complete
- [ ] LICENSE file present
- [ ] CHANGELOG.md present
- [ ] API documentation (if applicable)
- [ ] Inline code comments

### 🚀 Deployment

- [ ] Deployment platform chosen (Vercel/Netlify)
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] CDN configured
- [ ] Error monitoring setup (Sentry, etc.)
- [ ] Analytics setup (optional)
- [ ] Backup strategy defined

## 🧪 Testing Scenarios

### Scenario 1: New Game (3 Players)
1. Add 3 players: Alice, Bob, Charlie
2. Select category "Facile"
3. Start game
4. Each player reveals role
5. Verify: 2 Civils, 1 Undercover, 0 Mr. White
6. Play through discussion
7. Vote and eliminate
8. Verify game continues or ends correctly

### Scenario 2: New Game (6 Players)
1. Add 6 players
2. Select category "Expert"
3. Start game
4. Verify: 4 Civils, 1 Undercover, 1 Mr. White
5. Play until Mr. White eliminated
6. Mr. White makes guess
7. Players vote on guess
8. Verify correct winner

### Scenario 3: Vote Tie
1. Start game with 4 players
2. Force a tie vote (2-2)
3. Verify revote with only tied candidates
4. If second tie, verify random elimination

### Scenario 4: Resume Game
1. Start a game
2. Close browser
3. Reopen browser
4. Verify "Reprendre" button appears
5. Resume game
6. Verify state preserved correctly

### Scenario 5: Theme Toggle
1. Toggle to dark mode
2. Refresh page
3. Verify dark mode persists
4. Toggle to light mode
5. Verify light mode persists

### Scenario 6: Error Handling
1. Corrupt localStorage manually
2. Reload page
3. Verify ErrorBoundary catches error
4. Verify graceful fallback

## 🐛 Known Issues

Document any known issues here:

- [ ] None currently

## 📝 Post-Launch Tasks

- [ ] Monitor error logs
- [ ] Collect user feedback
- [ ] Track analytics (if enabled)
- [ ] Plan feature updates
- [ ] Address bug reports
- [ ] Update documentation as needed

## ✅ Final Sign-Off

- [ ] All critical items checked
- [ ] All blockers resolved
- [ ] Team approval obtained
- [ ] Ready for production deployment

---

**Last Updated**: [Date]
**Reviewed By**: [Name]
**Status**: [Draft / Ready / Deployed]
