# Changelog

All notable changes to this project are documented here.
Per-build release notes are published on the [Releases](../../releases) page.

## [Unreleased]

### Changed
- **Rename wallets:** every wallet card in the wallet drawers has a pencil that renames it, and the "WALLET #N" row in a wallet group's detail
  (next to SCAN) has the same pencil. The name is stored on the group (`labels`, aligned with the keys; empty name goes back to "Wallet N"), shows
  in every drawer, and follows its key when keys are removed or the group's keys are edited. Wallet cards are now two lines (name over address)
  so the pencil fits next to the check.
- **Rounded side drawers:** all side drawers (Connected Wallets, Browser wallet, Swap, Delegation, Send FROM/TO, Bridge, Transfer Hub, Base swap
  bot, RPC manager) now have the same big rounded top-left and bottom-left corners as the Home group drawer.
- **Wallet drawer, new look:** group cards are now tinted pills with a round wallet avatar and a smaller 13px name; wallet cards under a group are
  slim single-line rows ("Wallet 1", key icon, short address) pushed 20% in from the left and joined to the group by a thin line, so an expanded
  group takes much less height. Same shared drawer, so Swap, Send, Bridge, Transfer Hub and the other pickers all change together. Selection
  logic is unchanged.
- **Swipe to close (same everywhere):** every side drawer now closes with a swipe right and every bottom sheet with a swipe down, using ONE gesture
  (`sheet-swipe-close.js`) instead of about ten separate copies that behaved differently (80px / 72px / 60px / 55px thresholds, some with no
  flick, some that froze half-way when the WebView cancelled the touch, some that ignored a sideways wobble). Now: direction locks after 8px,
  closes at 60px or a quick flick, light resistance near the end, snaps back otherwise, a touch cancel or the app losing focus always finishes
  the gesture, and a list scrolled away from its top scrolls instead of closing. Swiping the dim area closes too. Drawers: Swap / Bridge
  wallet panels, Delegation group, Connected Wallets, Browser wallet (new), RPC manager, Swap wallet, Send from / to, Home chain group,
  Base Swap Bot, Transfer Hub and Smart Wallet pickers. Sheets: token action, token remove, add-token chain list, swap / bridge / send
  confirm, currency, token chain, exchange selector / pair, send / chain / history pickers. The list of who uses it is one file
  (`swipe-close-registry.js`); `wallet-picker-sync-and-swipe.js` is now `wallet-picker-sync.js`. The dim area no longer fades while dragging.
- **Wallet drawers:** every wallet picker now uses one shared drawer list (`wallet-drawer-ui.js`, `wallet-drawer-ui.css`) - Connected Wallets, Browser wallet, Swap wallet (profile + step 1), Swap signing wallet, Delegation, Transfer Hub picker, Base swap bot picker, Send FROM / TO, Home wallet and Bridge sender / recipient. **Single select** drawers (Browser, Swap signing, Send, Home, Bridge, Transfer Hub single / address) show radio rows: a group only expands and you pick one wallet from it, no multi tick. **Multi select** drawers (Connected Wallets, Swap wallet, Delegation, Transfer Hub multi, Base swap bot) show checkboxes: tick a group for all its wallets (partial shows a dash), or expand it and tick any wallets. The separate "groups -> keys" screens and back arrow are gone. Selection state, storage and key handling are unchanged. Transfer Hub / Base swap bot pickers now also tick the wallets of a group that is already loaded in the field.
- **Transfer Hub home:** the Send / Manage / Tools tabs are gone - all tools are listed together on one screen under small Send, Manage and Tools labels, with slightly tighter rows so everything fits without scrolling (`main-dashboard.html`, `th-hub-home-redesign.css`, `hub-home-tabs.js`).
- **Logs (Self, W2W, Token Approval, NFT Transfer):** tapping Logs now only expands the log box downwards - nothing above it changes or hides and the page does not scroll by itself (the earlier auto scroll-into-view is removed; on the fill-screen Self / W2W layouts the screen grows by the log box height so the cards keep their spacing).
- **NFT Transfer logs:** opening Logs no longer hides the NFT pick, hints and IDs; the log box is scrolled into view when it opens (`th-nft-transfer-mobile.css`, `nft-transfer-ui-sync.js`).
- **Token Approval logs:** opening Logs no longer folds / hides the key box and hints; the log box is scrolled into view when it opens (`th-token-approval-manager-mobile.css`, `token-approval-ui-sync.js`).
- **Self transfer layout:** the screen now fills the space down to the bottom nav bar like W2W (cards spread out, Logs strip sits right above the nav bar), no more big empty gap (`th-self-transfer-mobile.css`).
- **Self transfer + W2W logs:** opening Logs no longer folds / hides the key boxes, hints or amount chips - everything stays where it is and the log box is scrolled into view when it opens (fixes the Logs tap looking like it did nothing on W2W).
- **NFT Transfer + Self Transfer:** the action button (Transfer NFTs / Collect NFTs / Execute transfer) is now centred on the screen and only a little wider than its label; the gas pill stays on the left. Styling only (`th-nft-transfer-mobile.css`, `th-self-transfer-mobile.css`).
- **Multi Key Recipients + Batch Transfer:** the Amount per wallet / address label and value are now centred in the amount column (unit pinned to its right edge); the card layout, Send mode and Batch size stay where they were. Styling only (`th-amount-centered.css`), applies to Native and Token.
- **W2W transfer layout:** the screen now fills the space down to the bottom nav bar (fields spread out, Logs strip sits right above the nav bar), the Amount per transfer value is centred in its card, and the Execute transfer button is centred and only as wide as its label (gas pill stays on the left). Markup untouched; styling only (`th-w2w-compact.css`), applies to Native and Token.
- **Key & Address Tools UI:** now uses the same compact layout as the other transfer tools - a Phrase -> Key / Key -> Address
  switch, one card for phrases (or private keys) with Paste / Select buttons and a live count, derivation path and
  addresses-per-phrase side by side, Generate keys + Clear icon on one row, compact result rows (short address, masked key with
  show/hide, copy address / copy key icons) with Copy keys / Copy addresses in the results header, and collapsible Logs strips
  (Phrase -> Key now has a log too). Markup/styling only; element IDs, phrase/key/address logic and copy-all unchanged.
- **Balance Check UI:** now uses the same compact layout as the other transfer tools - a Native / Token switch (Native = token
  address empty, as before), one Wallets card with a "Select" button and a live count of addresses and keys found, a
  `wallets checked / Total` summary, Check balances + Clear icon on one row, compact result rows (short address, balance,
  copy icon) with CSV / JSON export in the results header, and a collapsible Logs strip. Markup/styling only; element IDs and
  balance-check logic unchanged.
- **Withdraw Manager UI:** now uses the same compact layout as W2W, Self Transfer, NFT Transfer and Token Approval - a selected-contract
  card (type tag, tappable address, Native and Token balances), one Developer wallet + Recipient card with "Select" buttons and
  a slim ownership strip, a `Native / Token` summary, gas pill + one Withdraw button on a row, compact contract rows with
  Add / Refresh / Clear icons, and a collapsible Logs strip. Token contracts get a Native / Token switch (Native clears the token
  address, because Withdraw Native only enables while it is empty). Markup/styling only; element IDs and withdraw logic unchanged.
- **Token Approval UI:** now uses the same compact layout as W2W, Self Transfer and NFT Transfer - one Wallets card
  ("Select" button, short masked key box, key count in the caption), one Approval card (Token contract, Spender, Amount
  with Unlimited / Custom / Revoke chips), a `wallets / ok / failed` summary, gas pill + Approve button + Clear icon on
  one row (the button reads "Revoke N wallets" when the amount is 0) and a collapsible Logs strip. Markup/styling
  only; element IDs and approval logic unchanged.
- **NFT Transfer UI:** now uses the same compact layout as W2W and Self Transfer - a 1 -> Many / Many -> 1 switch, grouped
  cards (Sender wallet + Recipients, or Source wallets + Recipient; NFT contract with a compact ERC721 / ERC1155 picker),
  flat 3-per-row NFT tiles with Fetch / All / Clear in the card header, a `selected of loaded` summary, gas pill and
  Transfer / Collect button on one row, and a collapsible Logs strip. Markup/styling only; element IDs and transfer logic
  unchanged (button labels no longer use emoji).
- **Self Transfer UI:** now uses the same compact layout as Multi Key Recipients and W2W so everything fits on one phone
  screen - Native / Token switch, one Wallets card ("Select" button, short masked key box; Token mode adds the token
  contract on top), an amount field with a TXs-per-wallet stepper and quick amount chips, a `wallets x TXs / Est. total`
  summary, gas pill and Execute transfer on one row, and a collapsible Logs strip that folds the key box when open.
  Markup/styling only; element IDs and transfer logic unchanged.
- **W2W Transfer UI:** now uses the same compact layout as Multi Key Recipients so everything fits on one phone
  screen without scrolling - one grouped card (Sender keys / Receivers, each with a "Select" button, a short masked key
  box and an "N valid" line; a "Only N pairs will run" note when the two lists differ), amount row with quick chips
  (MAX highlighted), a `pairs x amount / Total` summary, gas pill and Execute transfer on one row, and a collapsible
  Logs bar like Multi Key Recipients. Opening Logs (or starting a transfer) folds the key boxes so the log box stays on
  screen. Token mode has the same layout plus a Token contract row. Markup/styling only: element IDs and transfer
  logic are unchanged.
- **Multi Key Recipients UI:** now uses the same compact layout as Batch Transfer — one grouped card (Developer wallet /
  Sender keys with "N valid" and pool balance / Recipient), amount row with a Direct | Contract send-mode switch and
  quick chips (MAX highlighted), summary strip, contract row with gas pill and Deploy / Execute transfer, and a
  collapsible Logs bar. Token mode has the same card layout with a one-line retry note and a Start transfer button.
  Swipe left→right = Token, right→left = Native. Markup/styling only: element IDs and transfer logic are unchanged.
- **Batch Transfer spacing (Token only):** a light trim of box heights and gaps (recipients box, rows, summary, logs bar)
  so Deploy / Execute transfer and the collapsed Logs bar sit above the bottom nav in Token mode. Native keeps its
  original spacing. Layout is unchanged: gas pill above the buttons, Logs below them.
- **Batch Transfer buttons scroll again:** Deploy / Execute transfer are no longer pinned; they scroll with the form
  like before (gas pill above them, Logs below, collapsed by default). The page keeps its bottom padding so they
  can always be scrolled fully above the bottom nav.
- **Batch Transfer logs position:** Logs now sit below the docked Deploy / Execute row (still collapsed by default,
  tap the row to expand) instead of inside the scrolling form; the progress bar moved into the dock.
- **Batch Transfer layout fix:** the page is now a flex column while Batch Transfer is open - the form scrolls and the
  gas pill + Deploy / Execute transfer dock stays fixed just above the bottom nav (Native and Token). The previous
  sticky dock never stuck because `.container` is its own overflow box. Logs are collapsed by default and the whole
  Logs row is the tap target (Clear no longer toggles it).
- **Batch Transfer, round 3:** the Native / Token switch is now a small centered pill with a sliding thumb (no longer
  full width). Gas type + Deploy / Execute transfer are docked just above the bottom nav so they no longer disappear
  behind it while you scroll. Logs is collapsible (tap the header) and expanded by default with a taller box.
- **Batch Transfer polish (Native + Token):** the gas pill and the small Select / stepper / icon buttons were being
  stretched to 44px by the global touch rule - they are now compact again. Cards get soft depth, the Native / Token
  switch and the Execute button use the accent gradient, Deploy is an outlined secondary button, and the total strip,
  amount underline and stepper were tidied.
- **Batch Transfer gas type:** one small gas pill (top-right of the Deploy / Execute row) replaces the two duplicate
  Gas Type boxes. It shows only the current mode (AUTO by default); tap it to switch AUTO → 1559 → LEGACY. The same
  setting is used for Deploy and Execute, and the choice is now remembered across app restarts.
- **Batch Transfer buttons:** Deploy (left) and Execute transfer (right) sit side by side again.
- **Transfer Hub home redesigned:** the 3×3 emoji icon grid is replaced by a clean list with Send / Manage / Tools tabs,
  a short description under each tool, and theme-aware colors (works in dark and light mode). All tools open exactly as before.
- **Batch Transfer redesigned to fit one screen:** wallet, recipients, amount, contract and the Deploy / Execute buttons
  are now compact cards with a flat Native / Token switch, a batch-size stepper, one-line total summary and a short log
  box, so little or no scrolling is needed. Saved contracts open from a chevron on the contract row. Layout only: all
  fields, buttons and transfer logic are unchanged.

### Fixed
- **Explorer links were matched by text anywhere in the address:** a link was opened in the system browser if an
  explorer name appeared anywhere in it, even in a query like `?u=etherscan.io`. Only links whose host is an explorer
  (or a subdomain of one) are now treated as explorer links. Also removed an unused public CORS-proxy entry from the
  network configuration and a meaningless `autoVerify` flag from the `one://wallet` link.
- **Notifications stopped appearing after 50, and the "running" notification could come back after the app was killed:**
  after 50 notifications in one session every further transaction notification was silently dropped. Notification
  slots are now reused (oldest first) so they keep appearing. The background-service notification is no longer
  restarted by Android after the app is killed. The service still starts at app launch as before; making it start
  only while work is running is not included because background bots do not all report when they start and stop.
- **Screenshots work again inside the app:** the screenshot / screen-recording block (`FLAG_SECURE`) on the main wallet
  window is removed, so screenshots, screen recording, casting and the Recents preview are allowed. Trade-off: screens
  that display private keys or recovery phrases can now be captured too, so avoid sharing screenshots of those screens.
- **Pull-to-refresh could wipe the Bridge form during a bridge, and a cancelled pull left it stuck:** pulling down on
  the Bridge page while a bridge or swap was running cleared the selected route, amount and recipient mid-transaction.
  Pull-to-refresh is now ignored on the Bridge page while a transaction is running. Also, if a pull was interrupted
  (for example by a system gesture), the pull state and indicator are now reset instead of staying active.
- **Release builds could lose the dApp connection bridge:** only the main wallet bridge was protected from code
  shrinking, so the in-app browser's dApp bridge (connect, sign, send) could be renamed or removed in release builds.
  All bridge methods are now kept. This was fixed from the build configuration and still needs a release-build check
  on a device (connect, sign and send from a dApp).
- **The site name on the dApp approval sheet could belong to a different tab:** the name came from the last page that
  started loading in any tab, so with several tabs open the sheet could show another site's name. It now shows the
  address of the tab that actually sent the request.
- **dApp requests could hang forever when the rejection message contained a quote:** the error text sent back to the
  dApp was escaped in the wrong order, producing a script error, so the dApp's request never finished. The message is
  now safely encoded and the request always ends with the rejection.
- **Security: the native network helper accepted any address and any response size (partial fix):** it now only
  talks to `https://` addresses, refuses loopback, local-network and link-local addresses, stops reading a response
  after 8 MB, and ignores calls with a malformed callback id. A per-host allow-list is not included yet because this
  helper is used for exchange and aggregator requests to many different hosts and needs a device test first.
- **Security: web pages in the in-app browser could launch other apps without a tap:** any non-web link a page loaded
  (including from a redirect or script) was handed straight to Android. Now only `mailto:`, `tel:`, `sms:` and
  `wc:` links are passed on, and only when you tap them; all other schemes are ignored.
- **Security: any web page in the in-app browser could switch your chain or wallet, or open non-web links:** pages
  could call the wallet and chain "selected" callbacks and make the browser remember whatever they sent, and could ask the
  browser to open a tab for any kind of link. Those callbacks are removed; the chain and wallet now change only when
  you pick them in the native chain picker or wallet drawer. Pages can now only open `http://` and `https://` links in
  a new tab.
- **Security: exchange API keys and secrets were stored as plain text:** the API key, secret and passphrase for each
  connected exchange were saved as plain JSON in the app's storage, although the code comment said they were encrypted.
  They are now stored wrapped by a non-exportable Android Keystore key, the same way as the wallet secret. Keys saved
  by earlier versions are converted the next time they are read. If the Keystore is unavailable the previous behaviour is
  used. Use API keys with only the permissions you need (for example, no withdrawal permission if you do not use
  withdrawals in the app).
- **Security: swaps and bridges approved an unlimited token amount to an address supplied by the quote service:** the
  approval was for the maximum possible amount, to a spender taken from the aggregator's response, and if the approval
  timed out or failed to confirm the swap was still sent. Swap, Bridge and Pair-swap now approve only the amount being
  spent, refuse an empty or zero approval address, and stop (nothing is sent) if the approval cannot be confirmed
  on-chain. Because the approval is exact, a new approval is needed for each swap, so a swap that previously reused an
  old unlimited approval will now show an extra approve step.
- **Batch transfer sent 1 token per wallet when the amount was empty or invalid:** in fixed-amount mode an empty, `0`
  or non-numeric Amount silently became 1 whole token for every wallet, and values like `1e-7` failed part-way through.
  The amount is now checked before the bot starts: it must be a plain positive decimal number (for example `1` or
  `0.5`) with no more decimal places than the token has, otherwise nothing is sent and an error is shown in the log.
  Full-balance mode is unchanged.
- **Security: App Lock only appeared at a cold start and had no limit on wrong PIN / pattern attempts:** once unlocked,
  the app stayed unlocked until it was killed, and the PIN or pattern could be tried without limit. The lock screen now
  comes back when the app returns from the background after 30 seconds or more, and after 5 wrong PIN / pattern
  attempts entry is blocked for 30 seconds, doubling with each further miss (up to 1 hour). The count survives
  restarting the app and is cleared by a correct PIN, pattern or biometric unlock. (Not changed here: PIN hashing
  strength, re-asking for the PIN before removing the lock, and tying the encryption key to biometrics.)
- **Security: the wallet encryption secret was stored in plaintext next to the encrypted keys:** the random secret that
  the wallet keys are encrypted with was kept as plain text in the app's storage, right beside the data it protects, so
  anyone able to read that storage could decrypt the keys. The secret is now stored wrapped (AES-256-GCM) by a key held
  in the Android Keystore that cannot be exported from the device. Existing installs are migrated automatically on the
  next launch; if the Keystore is unavailable the app keeps working with the previous behaviour. If the wrapped secret
  can ever not be read, the app never creates a new one over it, so stored wallets are not orphaned. Note: this protects
  against reading the storage files, not against code running inside the app itself.
- **Security: wallet private keys were stored as plaintext on the device in several cases:** every save first wrote
  all keys as plain JSON to a backup entry, and the encrypt step silently returned the plaintext whenever no secret
  was available (for example with no app lock set), so keys could stay unencrypted on disk. Keys are now only ever
  written encrypted: no plaintext backup is written, a failed encryption stops the save and shows an error instead of
  storing plaintext, and with no app lock the app creates its own secret on first launch. Wallets and backups saved as
  plaintext by earlier versions are encrypted (and the old backup entry removed) the next time the app opens.
- **Removing App Lock could make wallets unreadable, and a later save could erase them:** removing the lock left the
  wallet keys encrypted with the lock's master secret, but on the next launch that secret was no longer applied, so the
  keys could not be decrypted. The app then cached the wallets with no keys, and the next save wrote that empty list over
  the stored keys. The master secret is now kept in use while no lock is enabled, and a wallet list that could not be
  decrypted is never cached or saved (changes are blocked with a message instead of overwriting the stored keys).
- **Security: WebView remote debugging was on in release builds:** `setWebContentsDebuggingEnabled(true)` ran
  unconditionally, so anyone with USB / ADB access to an unlocked phone could attach Chrome DevTools to the wallet view
  and read its storage. It is now enabled only when the app is debuggable (debug builds).
- **Security: NFT names, token symbols and chain names could run code in the wallet:** values that come from the chain
  or from remote metadata (NFT name / image / token id / collection name, ERC-20 `symbol()`, chain name / symbol, saved
  swap-pair labels) were put into `innerHTML` unescaped, so a spam NFT or token could run script in the view that holds
  the keys. They are now HTML-escaped at the NFT grids, the NFT chain pickers (which also no longer build `onclick`
  strings from chain data), the swap-pair preview and lists, and the dApp transaction summary; NFT image URLs must be
  `http(s)` or `data:image/*`. This covers the places named in the audit, not every `innerHTML` in the app.
- **Security: a dApp page could approve its own transactions and signatures:** the Confirm / Reject sheet for dApp
  requests was drawn inside the dApp page, and the approve call it used (`OneWeb3Bridge.modalApprove`) was callable by
  the page itself, so a malicious site could send a request and approve it without any tap. The confirmation is now a
  native sheet that the page cannot see or press: Approve / Reject are native buttons, the request id they act on is
  fixed when the sheet opens, and `modalApprove` / `modalReject` are no longer exposed to pages. The request summary is
  shown in a script-less view. Back, tapping outside the sheet, or navigating the tab rejects or closes it as before.
- **Security: a web page in the in-app browser could run code inside the wallet:** the wallet address, chain id and
  request method that a dApp page sends to the browser bridge were put into JavaScript run in the main wallet view with
  only the `"` character escaped, so a `\` in the input could break out of the string. These values are now validated
  at the bridge entry (address `0x` + 40 hex, chain id hex, method name charset) and passed as JSON-quoted literals;
  the transaction-modal labels are HTML-escaped. Applies to wallet select, chain select, dApp requests, account state
  and the transaction modal.
- **Swipe down to close no longer gets stuck half-way (Send token and Select token sheets):** the Send sheet and the Bridge
  chain / token pickers had their own swipe code, and a drag could freeze mid-screen: the WebView cancels the touch when it
  starts a native pan, and nothing handled that cancel; the gesture also gave up on the first sideways wobble or when the
  first few pixels were not straight down. All of them now use one shared helper (`scripts/shared/ui/sheet-swipe-close.js`)
  where every way a gesture can end (lift, cancel, app blur, new touch) resolves the sheet fully open or fully closed.
  Direction is locked after ~8px, a pull from the top of the token list drags the sheet, a scrolled list just scrolls, and
  swiping the dim area above the sheet closes it too. Bridge pickers keep their `!important` CSS states.

- **Bridge: scrolling the routes list triggered pull-to-refresh:** the bridge page never scrolls itself, so pull-to-refresh
  always saw "at the top" while the routes list scrolled inside it. Dragging the list back up then counted as a pull and
  could refresh (clear) the page. Pull-to-refresh on Bridge now only starts when the routes list is scrolled to its top.

### Changed
- **New app icon and logo:** a bold white "1" on a violet-to-cyan gradient replaces the previous glossy wallet icon. Updated the launcher icons (square and round), the browser favicon and the files in `docs/branding/`. All of them are generated from one definition by `tools/make_brand_assets.py`.
- **BRIDGE NOW / SWAP NOW button look:** the button is now a compact pill (fits its content, centred) with a `#e3edb7`
  soft gradient, dark text and a soft tinted shadow, in both dark and light theme. The look now lives in one CSS rule
  (`#br-exec-btn` in `styles/base/bridge-cards-bottom-nav-and-fab.css`, via `--br-exec-*` variables); scripts no longer
  write the old gradient inline when the button is reset, loading or re-enabled. The loading spinner uses the same text colour.
- **Bridge route cards width:** the route cards are inset by 10px more on the left and right, so they are narrower than
  the swap panel above. The card design itself is unchanged.
- **Bridge page layout:** FROM and TO now sit in one swap panel with the flip button on the divider between them.
  Chain and token pills are side by side on the left and the amount is on the right (FROM and TO); the balance
  (left) and USD value (right) share one row under them. The % slider and MAX stay in the FROM section, and the
  recipient row is now full width (34px tall) with a larger SELECT tag. The BRIDGE NOW button has more padding.
  Look and feel are unchanged, and every element id and handler is kept (`br-from-amount`, `br-pct-slider`,
  `br-flip-btn`, `br-exec-btn`, ...), so no script changes.
- **Bridge and Send token pickers now match the Swap one:** same compact **Select token** sheet (handle, header, 38px
  search with **Paste**, "All tokens on <chain>" label, 38px logos, selected row tinted with a tick, "No tokens found").
  Bridge keeps its LiFi list, contract-address lookup and balance sort; Send keeps its network tabs and "Highest value
  first" order and gains search. Token names and logos are now added to the list with DOM calls (no raw HTML), so a
  token with a crafted name cannot inject markup. The shared sheet classes (`sw-tp-*`) live in
  `styles/features/swap/swap-token-picker.css`.
- **Swap token picker redesign:** compact **Select token** sheet (80% height, slimmer handle / header / 38px search with a
  **Paste** button), 38px token logos, selected token highlighted with a tick, "All tokens on <chain>" label and a
  "No tokens found" empty state. New `styles/features/swap/swap-token-picker.css`; the dim backdrop is lighter.
- **Swipe down to close (token picker and other bottom sheets):** more reliable. Closes from the handle, header, the token
  list (when pulled down from its top) and the dim area above the sheet. Diagonal thumb swipes no longer abort (direction is
  locked after ~8px instead of cancelling at 38px sideways drift), short quick flicks close (60px / 0.35px/ms, smoothed
  velocity), a leftover timer from the previous gesture can no longer interfere, and the keyboard is dismissed on close.
  `touch-action` set on the sheet so the WebView does not take over the gesture.
- **Swap screen polish:** same layout and features, cleaner look. Larger header chips, bigger FROM / TO labels,
  borderless large amount text (24px in, 22px out), taller percent slider (1 / 25 / 50 / 75 / 100%) and MAX button,
  softer Swap button glow. **Live router** rows are now flat and inset 6% from both sides (neutral border; purple border and tick on
  the selected route, `BEST` tag on the top route), and Gas / Impact text wraps instead of being cut off with "...".
  Light-mode overrides updated to match.
- **Swap router list height:** the Live router list now measures the space between its top and the bottom nav
  (`swFitDexScroll`, re-run on resize and whenever the swap card changes), so the last router card is no longer
  hidden under the nav bar. Replaced the old fixed `calc(100vh - 420px ...)` guess and the 72px bottom padding.
- **Swap popups:** **Swap Settings** and **Recent Swaps** now open as centered popups (fade + scale) above the bottom
  nav instead of bottom sheets; tap outside, the X, or hardware back closes them (hardware back now also closes Recent
  Swaps). Opening either one drops focus from the amount field, so the keyboard no longer pops up. Slippage chips
  share the row evenly, history rows get a green check, larger text and a proper empty state. Swipe-down-to-close
  was removed for these two popups.
- **Swap gas type:** the three-button Gas Type row is now one compact "Network fee" pill above the Swap button.
  Default is AUTO; tap the pill to cycle AUTO / 1559 / LEGACY (`window._ngCycle`, same `OneGasMode` as before).
- **Send screen navigation:** swipe-down-to-close is turned off on the Send screen (it opts out with
  `data-no-swipe`); leave with the header back arrow or the hardware back button. Hardware back now closes the
  top layer first: Confirm transaction sheet, then Select token sheet, then the Send screen, then returns to the
  previous page. The bottom nav stays visible while Send is open.
- **Token action sheet redesign:** tapping a token now opens a calm bottom sheet: token header with chain dot, round
  chart and close buttons, a **Balance** row (read from the home token card), and Send / Swap / Bridge as one grouped
  list with a short subtitle each (no gradients or glow). Handlers unchanged (Send pre-selects token and chain, Swap and
  Bridge pass the token, Chart opens the full chart); swipe-down still closes this sheet. Styles moved from inline to
  `.tas-*` classes in `home-header-portfolio-and-token-list.css`.
- **Receive screen polish:** Group and Wallet stay as two dropdowns (taller, rounder, same field style as Send),
  larger QR with soft glow, balanced address card, COPY / SHARE buttons with a green "COPIED" state (now a CSS
  class instead of inline colors), and a note that the same address works on all EVM networks. Logic unchanged.
- **Select token sheet:** swipe down on the handle, header or the list (when scrolled to the top) to close it;
  a short drag snaps back.
- **Send screen redesign:** amount-first layout (token pill, 25/50/75/Max chips, balance), one From card with a
  short address, recipient field with paste + QR + "Choose from my wallets", and a state-aware SEND button
  ("Enter an amount" / "Enter recipient address" / "Send ETH"). New **Select token** sheet with an
  **All networks** tab and per-network tabs, sorted by USD value. Network fee row: tap the pill to cycle
  Auto / EIP-1559 / Legacy. New file `scripts/features/wallet/app-main/send-token-sheet.js`.
- **New logo (v3):** blue wallet with card, cash and "1" mark on a rounded-square with the "One Wallet" wordmark;
  launcher icons (square + round), splash, PWA icons, favicon/apple-touch icon, dApp provider icon and
  `docs/branding/` updated.
- **New logo (v2):** gradient coin with a "1" and a clasp notch on a dark rounded-square; launcher icons, splash,
  PWA icons, dApp provider icon and `docs/branding/` updated.
- **Rebrand to One Wallet.** New logo (`docs/branding/`), app name, launcher icons, splash/lock screen, PWA
  manifest/icons, notifications, biometric prompts, EIP-6963 provider name/icon, CI artifact names
  (`OneWallet-v*.apk`) and docs. All former brand identifiers were renamed: Java package/`namespace`/`applicationId`
  `com.one.wallet`, `One*` classes and files, `OneAndroid`/`OneBridge` JS bridges, `one_*` storage keys, the PBKDF2 salt,
  proxy/integrator ids. **This is a new app id: installs of earlier builds do not update in place and their on-device
  data is not carried over — export/back up wallets in the old app first, then import them into the new one.**
- Frontend files grouped into topic folders (65 files moved with `git mv`, content unchanged; the generated
  `index.html` is identical apart from paths, tag order unchanged): bridge scripts → `bridge/{pickers,history,routes,providers,execute}/`,
  `core/{capacitor-background,console,pwa}/`, `shared/{custom-rpc,currency}/`, `shared/rpc-manager.js` and the exchange
  deposit/withdraw modals and `base-swap-bot` now sit next to their parts, transfer wallet-picker → `transfer/wallet-picker/`,
  wallet token cache → `wallet/tokens/`, contract modals `web3/` → `transfer/contracts/`. Transfer Hub styles
  (`th-*` from `styles/base/` and `features/send/`) → `styles/features/transfer/`; lock-method picker and token manager
  styles → `features/wallet/`; swap page styles → `features/swap/`.
- HTML partial `exchange-deposit-modals` renamed to `exchange-deposit-withdraw-modals` (it holds the withdraw modals too);
  generated `index.html` byte-identical.
- `frontend/index.html` is no longer committed. It is generated from `html-src/` by Gradle (`:app:generateHtml`) before
  every build; the remaining inline markup in `index.src.html` was moved into partials (output byte-identical).
- Repository restructured: web UI moved from `app/src/main/assets/` to `frontend/`
  (`css/` → `styles/{base,shared,features}`, `js/` → `scripts/{core,shared,features}`, `js/vendor/` → `vendor/`).
- Java classes grouped by role: `browser/InAppBrowserActivity`, `service/OneForegroundService`,
  `bridge/OneAndroidBridge` (extracted from `MainActivity`; members it needs are now `public`; ProGuard rule updated).
- Frontend scripts regrouped by feature: bridge scripts → `scripts/features/bridge/`, swap UI → `features/swap/`,
  send overlay → `features/send/` (previously split between `wallet/delegation-modal/` and `shared/ui/`). Script order unchanged.
- CI now runs `tools/check_assets.py` before building.

### Added
- `docs/`, `.gitignore`, `.editorconfig`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`.

### Removed
- `PUSH_TO_GITHUB.sh` (obsolete bootstrap script that force-pushed to a different repository).
