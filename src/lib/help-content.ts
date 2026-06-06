export type HelpSection = {
  title: string;
  content: string[];
};

export type SetupWizardStepDetail = {
  number: number;
  title: string;
  summary: string;
  details: string[];
};

export const setupWizardSteps: SetupWizardStepDetail[] = [
  {
    number: 1,
    title: "Define facilities",
    summary: "Create the warehouses the system will manage.",
    details: [
      "Enter a short uppercase code (for example WH1, WH2) that operators will see on labels and pick lists.",
      "Add the warehouse name, city, and country so reports and audit trails identify the facility correctly.",
      "Mark whether the facility has a cool zone so the wizard pre-creates a temperature-controlled zone in step 2.",
    ],
  },
  {
    number: 2,
    title: "Define zones inside each facility",
    summary: "Group locations by purpose and temperature class.",
    details: [
      "Create zones such as Receiving, Putaway, Picking, Cool, Quarantine, or Bulk for each warehouse.",
      "Set the temperature class (ambient, cool, frozen) so directed putaway can match products to compatible zones.",
      "Mark zones that should not accept normal stock (for example Quarantine or Damaged) so suggestions skip them.",
    ],
  },
  {
    number: 3,
    title: "Generate bin locations for each zone",
    summary: "Decide how aisles, bays, levels, and depth positions are produced.",
    details: [
      "Pick the aisle count, bays per aisle, levels per bay, and depth (1\u20135) that match the physical racking.",
      "Confirm the location code pattern so labels match what is printed on the racks (Warehouse > Zone > Aisle > Bay > Level > Depth).",
      "Set capacity defaults (max weight, stack height) so the slot suggester respects the rack rating.",
    ],
  },
  {
    number: 4,
    title: "Review the final structure",
    summary: "Inspect the totals before anything is written to the database.",
    details: [
      "Verify warehouse, zone, location-template, and total-location counts in the review summary.",
      "Go back to any earlier step to fix mistakes \u2014 nothing is created until step 5 is run.",
      "On a brand-new tenant the wizard starts blank \u2014 every field is yours to fill in. When an existing warehouse is detected, current data is preloaded for review or extension.",
    ],
  },
  {
    number: 5,
    title: "Create the structure",
    summary: "Run the setup to create exactly the warehouses, zones, and bin locations you defined.",
    details: [
      "The wizard creates warehouses, zones, and every location row in a single transaction.",
      "Demo operational data (products, pallets, receipts, etc.) is no longer seeded by default \u2014 developers can opt in from the final step.",
      "On success the app navigates to Warehouses; you can re-run the wizard after a Reset All if the environment ever needs to be rebuilt.",
    ],
  },
];

export type HelpReference = {
  label: string;
  url: string;
  reason: string;
};

export type HelpArticle = {
  id: string;
  title: string;
  module: string;
  audience: string;
  keywords: string[];
  sections: HelpSection[];
  acronyms?: Record<string, string>;
  references?: HelpReference[];
};

export type RouteHelpDefinition = {
  id: string;
  title: string;
  summary: string;
  keyActions: string[];
  commonMistakes: string[];
  permissions: string;
  wikiArticleIds: string[];
};

const routeHelpDefinitions: Record<string, RouteHelpDefinition> = {
  dashboard: {
    id: "dashboard",
    title: "Dashboard",
    summary: "Use the dashboard to monitor inbound, storage, and outbound activity at a glance.",
    keyActions: ["Review pallet counts and open work", "Spot hold/quarantine stock", "Watch occupancy trends"],
    commonMistakes: ["Using dashboard totals as a substitute for task execution detail", "Ignoring hold/quarantine trends before releasing work"],
    permissions: "Visible to admins, managers, clerks, and operators.",
    wikiArticleIds: ["enterprise-dashboard-modes", "warehouse-brain", "lean-standard-work", "reporting-basics"],
  },
  warehouses: {
    id: "warehouses",
    title: "Warehouses",
    summary: "Warehouses define the top-level facilities used by all stock, users, and operational flows.",
    keyActions: ["Create active facilities", "Mark facilities inactive instead of deleting them", "Review cool-zone capability before setup"],
    commonMistakes: ["Creating duplicate warehouse codes", "Hiding a warehouse before moving dependent records"],
    permissions: "Managed by admins and warehouse managers.",
    wikiArticleIds: ["warehouse-setup", "settings-reset"],
  },
  clients: {
    id: "clients",
    title: "Clients",
    summary: "Clients identify stock ownership, receiving rules, and 3PL operating controls.",
    keyActions: ["Create active client owners", "Review mixed-stock permissions", "Keep inactive clients visible for history"],
    commonMistakes: ["Receiving stock under the wrong owner", "Deleting client context needed for historical receipts"],
    permissions: "Managed by admins and warehouse managers.",
    wikiArticleIds: ["client-ownership", "product-mastery", "receiving-flow"],
  },
  zones: {
    id: "zones",
    title: "Zones",
    summary: "Zones define logical storage and workflow areas such as staging, dispatch, quarantine, and cool storage.",
    keyActions: ["Create temperature-aligned zones", "Mark staging/dispatch/quarantine flags correctly", "Hide obsolete zones instead of deleting them"],
    commonMistakes: ["Mixing dispatch and staging rules in one zone", "Using the wrong temperature class for cool-chain stock"],
    permissions: "Managed by admins and warehouse managers.",
    wikiArticleIds: ["zone-design", "warehouse-setup"],
  },
  locations: {
    id: "locations",
    title: "Bin Locations",
    summary: "Bin Locations are the physical slots used for directed putaway, picking, counting, and occupancy reporting.",
    keyActions: ["Generate rack/staging/quarantine locations", "Print beam labels and bay-code labels", "Set sequencing and capacity rules", "Hide retired locations rather than removing history"],
    commonMistakes: ["Assigning inactive locations to live work", "Changing a physical code without reprinting the rack label", "Using mixed-SKU settings that conflict with product handling rules"],
    permissions: "Managed by admins and warehouse managers.",
    wikiArticleIds: ["location-generation", "warehouse-setup"],
  },
  products: {
    id: "products",
    title: "Products",
    summary: "Products define SKU identity, ownership, rotation rules, and handling requirements.",
    keyActions: ["Create active SKUs", "Set tracking flags correctly", "Hide discontinued products instead of deleting them"],
    commonMistakes: ["Using the wrong rotation method", "Leaving temperature requirements inconsistent with storage zones"],
    permissions: "Managed by admins, managers, and inventory clerks.",
    wikiArticleIds: ["product-mastery", "receiving-flow"],
  },
  "packaging-profiles": {
    id: "packaging-profiles",
    title: "Packaging Profiles",
    summary: "Packaging profiles define each/case/pallet pack sizes, dimensions, and default receiving behavior.",
    keyActions: ["Create default pack profiles", "Align barcodes to physical packaging", "Hide obsolete profiles without losing audit history"],
    commonMistakes: ["Creating multiple defaults for one product", "Using wrong units-per-package during receiving"],
    permissions: "Managed by admins, managers, and inventory clerks.",
    wikiArticleIds: ["packaging-profiles", "receiving-flow"],
  },
  receiving: {
    id: "receiving",
    title: "Receiving",
    summary: "Receiving creates receipts, pallet identity, lot context, and the downstream putaway workload.",
    keyActions: ["Create receipt and pallet records", "Capture lot/expiry details", "Launch directed putaway"],
    commonMistakes: ["Skipping reference numbers", "Receiving cool-chain items without proper profile or zone setup"],
    permissions: "Used by admins, managers, and inventory clerks.",
    wikiArticleIds: ["receiving-flow", "label-printing"],
  },
  putaway: {
    id: "putaway",
    title: "Putaway",
    summary: "Putaway confirms pallet and location scans before stock becomes stored and available.",
    keyActions: ["Scan pallet", "Scan a full location or shortened bay code", "Select an available bay cell when prompted", "Complete directed putaway with audit logging"],
    commonMistakes: ["Scanning the wrong location", "Treating a bay code as a final location", "Trying to store cool stock in ambient locations"],
    permissions: "Used by admins, managers, clerks, and operators.",
    wikiArticleIds: ["putaway-flow", "location-generation"],
  },
  inventory: {
    id: "inventory",
    title: "Inventory Search",
    summary: "Inventory search shows pallet, lot, zone, and warehouse state for live stock decisions.",
    keyActions: ["Search by SKU, pallet, lot, or location", "Open detailed pallet movement history", "Validate stock before picks or transfers"],
    commonMistakes: ["Ignoring status filters", "Using stale assumptions instead of the live record"],
    permissions: "Used by all operational roles except hidden/pending users.",
    wikiArticleIds: ["inventory-search", "status-controls"],
  },
  "pick-lists": {
    id: "pick-lists",
    title: "Pick Lists",
    summary: "Pick lists release outbound work and group the pick tasks operators must execute.",
    keyActions: ["Release lists", "Review shortages", "Open execution detail for assigned work", "Use shortened bay scans to visually confirm the pallet location"],
    commonMistakes: ["Releasing work before stock is available", "Ignoring shortage exceptions on generated tasks", "Confirming the wrong rack cell after a bay scan"],
    permissions: "Managed by admins, managers, and operators.",
    wikiArticleIds: ["pick-flow", "inventory-search"],
  },
  transfers: {
    id: "transfers",
    title: "Transfers",
    summary: "Transfers preserve pallet identity and audit history while stock moves between facilities.",
    keyActions: ["Create transfer", "Dispatch", "Receive into destination and trigger putaway"],
    commonMistakes: ["Dispatching the wrong pallet", "Receiving stock before destination structure is ready"],
    permissions: "Used by admins, managers, clerks, and dispatch drivers for handoff visibility.",
    wikiArticleIds: ["transfer-flow"],
  },
  "location-moves": {
    id: "location-moves",
    title: "Location Moves",
    summary: "Location moves relocate stored pallets inside a warehouse while preserving pallet identity and audit history.",
    keyActions: ["Look up the pallet", "Confirm the destination location", "Complete the scan-confirmed move"],
    commonMistakes: ["Moving stock to a disabled or full location", "Using transfers when the pallet is staying in the same warehouse"],
    permissions: "Used by admins, managers, inventory clerks, and operators.",
    wikiArticleIds: ["location-move-flow", "inventory-search", "location-generation"],
  },
  "cycle-counts": {
    id: "cycle-counts",
    title: "Cycle Counts",
    summary: "Cycle counts generate count work and record variances against expected stock.",
    keyActions: ["Generate count sheets", "Submit counted quantities", "Investigate exceptions"],
    commonMistakes: ["Counting from memory instead of live location verification", "Ignoring variance thresholds"],
    permissions: "Used by admins, managers, clerks, and operators.",
    wikiArticleIds: ["cycle-counts"],
  },
  status: {
    id: "status",
    title: "Statuses",
    summary: "Status controls move stock into hold, quarantine, damaged, missing, or available with audit reasons.",
    keyActions: ["Apply controlled statuses", "Record a reason", "Review controlled stock"],
    commonMistakes: ["Changing status without reason detail", "Forgetting that controlled stock still affects decisions"],
    permissions: "Used by admins, managers, and inventory clerks.",
    wikiArticleIds: ["status-controls"],
  },
  reports: {
    id: "reports",
    title: "Reports",
    summary: "Reports give operational snapshots across stock, occupancy, counts, and recent audit events.",
    keyActions: ["Review stock by warehouse", "Check occupancy", "Monitor recent movements"],
    commonMistakes: ["Treating snapshots as substitutes for transactional detail", "Ignoring audit trends"],
    permissions: "Visible to admins, managers, and clerks.",
    wikiArticleIds: ["reporting-basics", "warehouse-brain", "enterprise-dashboard-modes"],
  },
  users: {
    id: "users",
    title: "Users & Roles",
    summary: "User management assigns role-based access, badge credentials, and non-destructive access removal.",
    keyActions: ["Add users as Admin or Dev", "Assign roles", "Issue badge codes and PINs", "Hide or restore role assignments", "Enable or disable profiles without deleting audit history"],
    commonMistakes: ["Removing the wrong role assignment", "Disabling a profile before reassigning operational work"],
    permissions: "Managed by admins.",
    wikiArticleIds: ["user-management"],
  },
  "system-log": {
    id: "system-log",
    title: "System Log",
    summary: "System logs record operational issues, admin notes, snapshots, and resolution status.",
    keyActions: ["Review recent log entries", "Resolve addressed issues", "Capture record-count snapshots"],
    commonMistakes: ["Resolving a log before the underlying issue is fixed", "Using logs as a substitute for transactional audit history"],
    permissions: "Visible to admins and warehouse managers.",
    wikiArticleIds: ["system-log-operations", "reporting-basics"],
  },
  "email-log": {
    id: "email-log",
    title: "Email Log",
    summary: "Email logs show outbound message attempts, delivery status, and failure details for support.",
    keyActions: ["Review failed messages", "Check recipient and template", "Escalate repeated delivery failures"],
    commonMistakes: ["Retrying without checking the error message", "Assuming an invitation was received without confirming delivery status"],
    permissions: "Visible to admins.",
    wikiArticleIds: ["email-log-operations", "user-management"],
  },
  settings: {
    id: "settings",
    title: "Settings",
    summary: "Settings now houses environment guidance, full reset controls, and the setup wizard entry point.",
    keyActions: ["Review setup guidance", "Launch the warehouse setup wizard", "Run Reset All with confirmation"],
    commonMistakes: ["Running reset without understanding that warehouse/setup data will be rebuilt", "Skipping the wizard after reset"],
    permissions: "Visible to admins and warehouse managers. Reset is admin-only.",
    wikiArticleIds: ["settings-reset", "warehouse-setup", "netsuite-integration", "label-printing"],
  },
  help: {
    id: "help",
    title: "Help Center",
    summary: "The Help Center is the searchable wiki for operators, supervisors, and administrators.",
    keyActions: ["Search articles", "Open module-specific guides", "Use linked context from the help sidebar"],
    commonMistakes: ["Searching too narrowly by exact title only", "Using an outdated process instead of the in-app wiki"],
    permissions: "Visible to all approved users.",
    wikiArticleIds: ["help-center", "warehouse-setup", "receiving-flow"],
  },
  "setup-wizard": {
    id: "setup-wizard",
    title: "Warehouse Setup Wizard",
    summary: "The wizard builds warehouse structure from blank forms; demo operational data is opt-in for developers only.",
    keyActions: ["Define warehouses", "Define zones", "Generate bin locations", "Review and create structure"],
    commonMistakes: ["Leaving warehouse codes inconsistent across steps", "Choosing location rules that do not match the actual zone purpose"],
    permissions: "Visible to admins and warehouse managers. Execution uses admin reset/setup controls.",
    wikiArticleIds: ["warehouse-setup", "settings-reset"],
  },
};

export const helpArticles: HelpArticle[] = [
  {
    id: "help-center",
    title: "Using the Help Center",
    module: "help",
    audience: "All operators",
    keywords: ["help", "wiki", "search", "articles", "documentation"],
    sections: [
      { title: "Overview", content: ["The Help Center is the searchable documentation hub for the warehouse system.", "Use the sidebar on any page for quick context, then open the full wiki when you need deeper instructions."] },
      { title: "Search Tips", content: ["Search by module name, workflow name, or operational term such as receiving, transfer, cycle count, or quarantine.", "Results match titles, keywords, and article content."] },
    ],
  },
  {
    id: "warehouse-setup",
    title: "Warehouse Setup Wizard",
    module: "setup-wizard",
    audience: "Admins and warehouse managers",
    keywords: ["wizard", "setup", "warehouse", "zones", "bin locations", "seed"],
    sections: [
      { title: "When to Use It", content: ["Use the wizard during a new implementation or after a full environment reset.", "On a fresh tenant every form starts blank \u2014 the wizard never invents warehouses, zones, or locations.", "When an existing warehouse environment is detected, current structure is preloaded so new facilities or storage areas can be layered in for review."] },
      { title: "Step Sequence", content: ["Step 1 defines facilities.", "Step 2 defines zones inside each facility.", "Step 3 defines how locations are generated for each zone.", "Step 4 reviews the final structure.", "Step 5 creates the structure (demo operational data is opt-in for developers)."] },
    ],
  },
  {
    id: "settings-reset",
    title: "Reset All and Rebuild",
    module: "settings",
    audience: "Admins",
    keywords: ["reset", "settings", "rebuild", "seed", "wipe", "start over"],
    sections: [
      { title: "What Reset Does", content: ["Reset All clears warehouse setup and operational data while preserving users, approvals, and role assignments.", "Warehouse-scoped references are cleared so the environment can be rebuilt safely."] },
      { title: "After Reset", content: ["The next step is to launch the setup wizard and rebuild the warehouse structure.", "Starter operational data can be seeded automatically so the system is usable immediately."] },
    ],
  },
  {
    id: "user-management",
    title: "Users, Roles, Badges, and Access Removal",
    module: "users",
    audience: "Admins",
    keywords: ["users", "roles", "remove access", "disable profile", "restore", "badge", "user code", "activity"],
    sections: [
      { title: "Admin Control Model", content: ["Users are not self-authorizing. Public Request Access is disabled; Admin and Dev users create accounts, approve profiles, assign roles, issue short user codes, and may issue scannable badge codes for warehouse tablets.", "The user code is shorter than an email address because operators wearing gloves or working at a dock need fewer keystrokes. Passwords are still required so a lost badge is not enough to sign in."] },
      { title: "Trusted Badge Sign-In", content: ["Badge sign-in is a shortcut only after a user has completed a normal password login on that mobile or tablet device. It is disabled on desktop and expires after 30 days.", "The server checks the active user, badge/PIN hash, trusted device ID, active trust record, expiry, client IP, and non-desktop client before creating a session. Failed checks fall back to normal sign-in without revealing which check failed."] },
      { title: "Role Assignment", content: ["Assign the smallest role that lets the person complete their standard work. Operators see execution queues; clerks see receiving, counts, product data, and inventory; drivers see transfer handoff; admins keep full access.", "Role assignments should be hidden or restored, not deleted outright, so access history is preserved."] },
      { title: "Profile Control", content: ["Disable a profile when the person should not sign in. Hide a role assignment when the person remains active but should lose one area of access.", "Every profile or role change is written to activities so supervisors can answer who changed access, when, and why."] },
    ],
    acronyms: {
      SSO: "Single sign-on. Badge/code login behaves like SSO for the floor but remains built into the WMS.",
      WMS: "Warehouse management system.",
    },
  },
  {
    id: "client-ownership",
    title: "Client Ownership and 3PL Rules",
    module: "clients",
    audience: "Admins and warehouse managers",
    keywords: ["clients", "3pl", "owner", "mixed stock", "ownership", "receiving rules"],
    sections: [
      { title: "Purpose", content: ["Client records identify who owns the stock and which handling rules apply during receiving, storage, picking, and reporting.", "Keep client codes short and stable because they appear in searches, labels, exports, and audit trails."] },
      { title: "Controls", content: ["Mixed-stock and expiry requirements should match the commercial operating agreement.", "Deactivate obsolete clients instead of deleting them so historical receipts, pallets, and reports still explain who owned the goods."] },
    ],
    acronyms: {
      "3PL": "Third-party logistics provider.",
      SLA: "Service-level agreement.",
    },
  },
  {
    id: "receiving-flow",
    title: "Receiving Workflow",
    module: "receiving",
    audience: "Clerks and supervisors",
    keywords: ["receiving", "receipt", "pallet", "lot", "expiry", "putaway"],
    sections: [
      { title: "Core Flow", content: ["Receiving creates the receipt, lot context, pallet identity, and the downstream putaway task.", "Reference numbers and packaging profiles should be entered carefully because they affect later handling."] },
      { title: "Critical Checks", content: ["Confirm warehouse, product, quantity, and lot/expiry values before posting.", "Cool-chain items must align with cool-zone storage."] },
    ],
  },
  {
    id: "putaway-flow",
    title: "Directed Putaway",
    module: "putaway",
    audience: "Operators and supervisors",
    keywords: ["putaway", "scan", "location", "temperature", "store"],
    sections: [
      { title: "How It Works", content: ["Putaway is complete only after the pallet barcode and location barcode are both confirmed.", "A full location code fills the confirmation field directly. A shortened bay code opens the bay selector so the operator can tap the exact available slot.", "Successful confirmation moves stock into stored and available status."] },
      { title: "Common Exceptions", content: ["A location that is inactive, full, or temperature-incompatible will block the move.", "Scan mismatches should be corrected before retrying."] },
    ],
  },
  {
    id: "inventory-search",
    title: "Inventory Search and Detail",
    module: "inventory",
    audience: "All operations users",
    keywords: ["inventory", "search", "detail", "pallet", "lot", "history"],
    sections: [
      { title: "Search Usage", content: ["Search inventory to locate stock by SKU, pallet, lot, warehouse, or location.", "Open the detail page to inspect quantity, status, lot context, and recent movements."] },
    ],
  },
  {
    id: "pick-flow",
    title: "Pick Lists and Execution",
    module: "pick-lists",
    audience: "Managers and operators",
    keywords: ["pick", "pick list", "execution", "short", "outbound"],
    sections: [
      { title: "Release to Execution", content: ["Managers create pick lists and the system generates pick tasks from available inventory.", "Operators then confirm the assigned pallet, location, and picked quantity. A shortened bay code can open the bay grid and highlight the pallet's assigned location before confirmation."] },
      { title: "Shorts and Exceptions", content: ["Any shortage or mismatch should be recorded during confirmation so the audit trail stays complete.", "Do not force picks from unverified stock."] },
    ],
  },
  {
    id: "transfer-flow",
    title: "Warehouse Transfers",
    module: "transfers",
    audience: "Managers, clerks, and dispatch staff",
    keywords: ["transfer", "dispatch", "receive", "inter-warehouse", "intra-warehouse", "in transit", "driver signoff"],
    sections: [
      { title: "Transfer Stages", content: ["Transfers move a pallet from source warehouse, to in-transit, then to receiving at the destination. The source record, destination record, pallet identity, and lot identity stay connected.", "Destination receipt should be followed by directed putaway so inventory does not sit invisible in a receiving lane."] },
      { title: "Driver Departure Sign-Off", content: ["Before dispatch, the driver scans their badge or enters their user code. This creates a signed handoff that stock has physically departed.", "This control prevents the waste loop where the system says a pallet is in transit while the pallet is still in staging, loaded on the wrong vehicle, or awaiting paperwork."] },
      { title: "Lean Reasoning", content: ["Treat transfer departure as a quality gate: scan pallet, validate route, sign off driver, then move to in-transit. The extra seconds prevent motion, waiting, searching, and correction work later.", "If a transfer is blocked, stop the flow visibly instead of dispatching a bad load. That is an Andon-style escalation while the problem is still cheap to fix."] },
    ],
    acronyms: {
      FEFO: "First Expired, First Out.",
      FIFO: "First In, First Out.",
      Andon: "A lean visual control that signals a problem and prompts rapid response.",
    },
  },
  {
    id: "location-move-flow",
    title: "Location Moves",
    module: "location-moves",
    audience: "Operators and supervisors",
    keywords: ["location move", "move task", "relocate", "pallet move", "same warehouse", "scan"],
    sections: [
      { title: "When to Use It", content: ["Use Location Moves when a pallet stays in the same warehouse but needs a new bin, staging area, or picking area.", "Use Transfers only when the stock changes warehouse or requires dispatch/receiving handoff."] },
      { title: "Scan Control", content: ["The pallet barcode confirms identity and the destination location confirms where the stock physically moved.", "If the location is blocked, disabled, full, or physically wrong, stop and correct the destination before posting the move."] },
    ],
  },
  {
    id: "cycle-counts",
    title: "Cycle Counts",
    module: "cycle-counts",
    audience: "Clerks, operators, and supervisors",
    keywords: ["cycle count", "variance", "count sheet", "stock check"],
    sections: [
      { title: "Counting Rules", content: ["Cycle counts can target a location, zone, SKU, or spot check. High-value, high-risk, and high-velocity stock should be counted more often than slow, stable stock.", "Entered quantities update stock and create adjustment records when variances exist. Variance is evidence of a broken handoff somewhere in receiving, putaway, picking, transfer, or status control."] },
      { title: "Six Sigma View", content: ["DPMO is a defect-per-million-opportunities signal. In WMS terms, a defect can be a wrong location, wrong quantity, missing pallet, or wrong status.", "Use DMAIC thinking: define the defect, measure where it happens, analyze the cause, improve the process, and control it with scans, roles, labels, and standard work."] },
    ],
    acronyms: {
      DPMO: "Defects per million opportunities.",
      DMAIC: "Define, Measure, Analyze, Improve, Control.",
      SKU: "Stock keeping unit.",
    },
    references: [
      { label: "ASCM Supply Chain Dictionary", url: "https://learn.ascm.org/sfc/servlet.shepherd/document/download/069R3000006PlDHIA0?operationContext=S1", reason: "Useful for standard inventory and cycle-count terminology." },
    ],
  },
  {
    id: "status-controls",
    title: "Status Controls",
    module: "status",
    audience: "Clerks and supervisors",
    keywords: ["status", "hold", "quarantine", "damaged", "missing", "available"],
    sections: [
      { title: "Purpose", content: ["Status controls keep restricted stock visible and auditable.", "Every status change requires a reason because it affects downstream operations."] },
    ],
  },
  {
    id: "label-printing",
    title: "Label Printing and Reprints",
    module: "receiving",
    audience: "Clerks and supervisors",
    keywords: ["labels", "printing", "barcode", "qr", "reprint", "pallet label", "location label", "bay label", "zone label"],
    sections: [
      { title: "When Labels Matter", content: ["Labels connect the physical pallet, location, zone, or warehouse sign to the system record operators scan.", "Print labels immediately after receiving or master-data setup so the next workflow does not depend on hand-written identifiers."] },
      { title: "Location and Bay Labels", content: ["Per-row location labels and batch location sheets use the same beam-label layout: text on the left and QR on the right. Batch location sheets print on Avery 99 x 38 mm labels.", "Bay code labels remove the level number and print one shortened bay code such as WH-ZONE-A-01. Bay and zone aisle sheets print on Avery 99 x 93 mm labels."] },
      { title: "Reprint Rules", content: ["Reprint when a barcode is damaged, unreadable, or missing; do not create a new pallet or location just to replace a label.", "If a location code is intentionally changed, reprint the physical label before sending operators to that rack."] },
    ],
  },
  {
    id: "reporting-basics",
    title: "Reports and Operational Snapshots",
    module: "reports",
    audience: "Supervisors and managers",
    keywords: ["reports", "dashboard", "occupancy", "audit", "stock by warehouse"],
    sections: [
      { title: "Using Reports", content: ["Reports show current conditions and recent activity, not a replacement for reviewing live tasks.", "Use reports to spot bottlenecks, occupancy pressure, and controlled stock."] },
    ],
  },
  {
    id: "zone-design",
    title: "Zone Design Principles",
    module: "zones",
    audience: "Admins and warehouse managers",
    keywords: ["zones", "dispatch", "staging", "quarantine", "cool", "design"],
    sections: [
      { title: "Best Practice", content: ["Keep staging, dispatch, quarantine, and storage use cases distinct.", "Assign temperature classes based on physical handling realities, not convenience."] },
    ],
  },
  {
    id: "location-generation",
    title: "Generating Locations",
    module: "locations",
    audience: "Admins and warehouse managers",
    keywords: ["locations", "generation", "aisles", "bays", "levels", "capacity"],
    sections: [
      { title: "Templates", content: ["Location templates generate consistent codes and capacities across a zone. Codes should be readable in the aisle and sortable in the system.", "Aisle, bay, and level counts should match the real warehouse footprint you want operators to use. Never create virtual locations that operators cannot physically find."] },
      { title: "Rack and Bay Codes", content: ["Full location labels identify the exact rack cell, including level. Bay labels remove the level so scanning the bay code opens a selector for every active location in that bay.", "This supports rack-upright scanning without creating separate bay records. The selector still uses the existing aisle, bay, level, depth, capacity, and status fields."] },
      { title: "Import Template", content: ["Use the CSV template for bulk location creation when you already know the warehouse and zone IDs. Required fields prevent partial locations from entering directed work.", "Sequence fields should reflect walking and travel paths. Good sequencing removes motion waste by guiding putaway and picking through a sensible route."] },
    ],
    acronyms: {
      CSV: "Comma-separated values file.",
      ID: "Unique database identifier.",
      WIP: "Work in process.",
    },
  },
  {
    id: "product-mastery",
    title: "Product and Master Data Setup",
    module: "products",
    audience: "Clerks and supervisors",
    keywords: ["products", "sku", "master data", "rotation", "temperature"],
    sections: [
      { title: "Critical Fields", content: ["The most important product controls are owner, rotation method, temperature requirement, and tracking flags. These fields drive receiving checks, putaway location eligibility, pick rotation, labels, and reports.", "Discontinued products should be hidden rather than deleted so historical receipts, picks, counts, and transfers still explain themselves."] },
      { title: "Import Template", content: ["Use the CSV template before importing products. Fill required identifiers first: SKU, name, client owner, temperature requirement, rotation method, and active flag.", "Do not import unknown temperature or rotation values. Bad master data creates waste immediately because every downstream scan asks the system to enforce the wrong rule."] },
    ],
    acronyms: {
      SKU: "Stock keeping unit.",
      CSV: "Comma-separated values file.",
      FEFO: "First Expired, First Out.",
      FIFO: "First In, First Out.",
    },
  },
  {
    id: "packaging-profiles",
    title: "Packaging Profiles",
    module: "packaging-profiles",
    audience: "Clerks and supervisors",
    keywords: ["packaging", "profiles", "each", "case", "pallet", "barcode"],
    sections: [
      { title: "Purpose", content: ["Packaging profiles connect the physical unit of measure to receiving and handling behavior.", "Keep one default profile for each commonly received pack style."] },
    ],
  },
  {
    id: "enterprise-dashboard-modes",
    title: "Enterprise Dashboard Modes",
    module: "dashboard",
    audience: "Operators, supervisors, and managers",
    keywords: ["floor mode", "dock handoff", "office dashboard", "dumbwaiter", "andon", "widgets"],
    sections: [
      { title: "Floor Mode", content: ["Use Floor mode at shift start on tablets or shared workstations.", "The large workflow cards point operators to scan-confirmed putaway, picking, exception, and setup work."] },
      { title: "Dock Handoff", content: ["Dock mode is the dumbwaiter-style board for staged outbound goods.", "Loads are grouped by ready, called, loading, blocked, and loaded so delivery handoff starts from a clear status lane."] },
      { title: "Office Monitoring", content: ["Office mode is for managers watching fill level, inventory turn signals, expiration risk, DPMO, setup readiness, and Warehouse Brain recommendations."] },
    ],
  },
  {
    id: "zebra-printing",
    title: "Zebra ZPL Printing Setup",
    module: "receiving",
    audience: "Admins and inventory clerks",
    keywords: ["zebra", "zpl", "labels", "printer station", "barcode", "reprint"],
    sections: [
      { title: "Printer Model", content: ["Enterprise printing is ZPL-first. Printer stations, templates, print jobs, and failures are tracked so labels can be reprinted with an audit trail.", "Browser printing remains useful for office fallback but should not be the primary warehouse station path."] },
      { title: "Label Standards", content: ["Use Code 128-compatible pallet, location, carton, pick list, transfer, and count sheet labels. For customer-facing logistics labels, GS1-128 is the common standards path.", "Keep barcode values short, unique, and aligned with NetSuite item/location identifiers where possible. Warehouse labels should scan quickly and print reliably before they try to carry every possible data point."] },
    ],
    acronyms: {
      ZPL: "Zebra Programming Language.",
      GS1: "Global standards organization for supply chain identifiers and barcodes.",
      SSCC: "Serial Shipping Container Code.",
    },
    references: [
      { label: "GS1 Barcode Standards", url: "https://www.gs1.org/standards/barcodes", reason: "Primary source for barcode symbologies and GS1 standards." },
      { label: "GS1 Logistic Label Guideline", url: "https://www.gs1.org/standards/gs1-logistic-label-guideline/1-3", reason: "Reference for logistics labels, GS1-128 usage, and scanner expectations." },
    ],
  },
  {
    id: "netsuite-integration",
    title: "NetSuite Integration Setup",
    module: "settings",
    audience: "Admins and IT",
    keywords: ["netsuite", "api", "integration", "sync", "webhook", "external id"],
    sections: [
      { title: "First Adapter", content: ["NetSuite is the first-class ERP adapter for item, purchase order, item receipt, sales order, transfer order, fulfillment, and inventory adjustment sync.", "All sync jobs should use idempotency keys and preserve raw payload logs for support."] },
      { title: "Operational Safety", content: ["Use external record links to avoid duplicate products, orders, receipts, and adjustments.", "Repeated failures should move into dead letters with a clear reason and resolution owner."] },
    ],
  },
  {
    id: "warehouse-brain",
    title: "Warehouse Brain Recommendations",
    module: "reports",
    audience: "Managers and supervisors",
    keywords: ["ai", "warehouse brain", "recommendations", "alerts", "low stock", "expiration", "low turn"],
    sections: [
      { title: "What It Watches", content: ["The Warehouse Brain reviews live inventory, open work, holds, quarantine, expiration dates, cycle-count variance, dock status, and role context.", "Recommendations must explain the reason and next action so humans stay in control."] },
      { title: "Daily Review", content: ["Review recommendations at shift start, before wave release, and during end-of-day management checks.", "Accept, dismiss, or resolve recommendations with reason codes once the backing database workflow is enabled."] },
    ],
  },
  {
    id: "lean-standard-work",
    title: "Lean Warehouse Standard Work",
    module: "dashboard",
    audience: "Managers and supervisors",
    keywords: ["lean", "5s", "standard work", "waste", "andon", "kaizen", "six sigma"],
    sections: [
      { title: "Why It Matters", content: ["The WMS should make the correct action the easiest action. Scan prompts, role-specific screens, templates, sign-offs, and activity logs exist to remove ambiguity, not to add bureaucracy.", "Standard work means every shift receives, puts away, picks, transfers, counts, and changes status the same controlled way unless a supervisor deliberately changes the process."] },
      { title: "Waste Removal", content: ["The biggest warehouse wastes are searching, walking, waiting, re-keying, rechecking, correcting, and explaining what happened after the fact.", "Role-specific UI reduces over-processing. CSV templates reduce defects at import. Badge/code login reduces time at shared devices. Driver sign-off prevents invisible transport errors."] },
      { title: "5S Connection", content: ["5S becomes real when locations are named, labels scan, blocked stock is visible, and each person has clear responsibility for sustaining the process.", "Use dashboard exceptions as a daily 5S audit signal: blocked locations, quarantine buildup, missing stock, and repeated scan failures indicate where standard work is slipping."] },
    ],
    acronyms: {
      "5S": "Sort, Set in order, Shine, Standardize, Sustain.",
      WMS: "Warehouse management system.",
      UI: "User interface.",
    },
    references: [
      { label: "EPA Lean 5S Overview", url: "https://www.epa.gov/sustainability/lean-thinking-and-methods-5s", reason: "Clear public reference for 5S, workplace organization, waste, and standard work." },
    ],
  },
  {
    id: "system-log-operations",
    title: "System Log Operations",
    module: "system-log",
    audience: "Admins and warehouse managers",
    keywords: ["system log", "audit", "resolve", "snapshot", "severity", "operations"],
    sections: [
      { title: "Use Case", content: ["The System Log is for support notes, operational exceptions, and admin-visible events that need ownership or follow-up.", "Record-count snapshots are useful after setup, reset, import, or support activity because they provide a quick environment health checkpoint."] },
      { title: "Resolution", content: ["Resolve a log entry only after the real issue has been handled.", "Use severity to keep attention on problems that can block work, corrupt data, or hide operational exceptions."] },
    ],
  },
  {
    id: "email-log-operations",
    title: "Email Log Operations",
    module: "email-log",
    audience: "Admins",
    keywords: ["email", "delivery", "delivery status", "invite", "failure", "template", "recipient", "queue"],
    sections: [
      { title: "What It Shows", content: ["The Email Log shows outbound message attempts by template, recipient, status, time, and error detail.", "Use it to verify invitations, password recovery messages, and other system-generated emails before escalating to users or IT."] },
      { title: "Failure Handling", content: ["Check the recipient address, template, and error message before retrying or asking the user to check their mailbox.", "Repeated failures usually indicate provider configuration, DNS, suppression, or invalid address issues."] },
    ],
  },
];

const routeMatchers: Array<{ match: (pathname: string) => boolean; helpId: string }> = [
  { match: (pathname) => pathname === "/dashboard", helpId: "dashboard" },
  { match: (pathname) => pathname === "/clients", helpId: "clients" },
  { match: (pathname) => pathname === "/warehouses", helpId: "warehouses" },
  { match: (pathname) => pathname === "/zones", helpId: "zones" },
  { match: (pathname) => pathname === "/locations", helpId: "locations" },
  { match: (pathname) => pathname === "/products", helpId: "products" },
  { match: (pathname) => pathname === "/packaging-profiles", helpId: "packaging-profiles" },
  { match: (pathname) => pathname === "/receiving", helpId: "receiving" },
  { match: (pathname) => pathname === "/putaway-tasks", helpId: "putaway" },
  { match: (pathname) => pathname === "/inventory-search" || pathname.startsWith("/inventory/"), helpId: "inventory" },
  { match: (pathname) => pathname === "/pick-lists" || pathname.startsWith("/pick-lists/"), helpId: "pick-lists" },
  { match: (pathname) => pathname === "/transfers", helpId: "transfers" },
  { match: (pathname) => pathname === "/location-moves", helpId: "location-moves" },
  { match: (pathname) => pathname === "/cycle-counts", helpId: "cycle-counts" },
  { match: (pathname) => pathname === "/status", helpId: "status" },
  { match: (pathname) => pathname === "/reports", helpId: "reports" },
  { match: (pathname) => pathname === "/users", helpId: "users" },
  { match: (pathname) => pathname === "/system-log", helpId: "system-log" },
  { match: (pathname) => pathname === "/email-log", helpId: "email-log" },
  { match: (pathname) => pathname === "/settings", helpId: "settings" },
  { match: (pathname) => pathname === "/help", helpId: "help" },
  { match: (pathname) => pathname === "/setup-wizard", helpId: "setup-wizard" },
];

export function getRouteHelp(pathname: string) {
  const matched = routeMatchers.find((route) => route.match(pathname));
  return matched ? routeHelpDefinitions[matched.helpId] : routeHelpDefinitions.dashboard;
}

export function getArticleById(articleId: string) {
  return helpArticles.find((article) => article.id === articleId);
}

export function getAllRouteHelpDefinitions() {
  return Object.values(routeHelpDefinitions);
}

export function searchHelpArticles(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return helpArticles;
  }

  return helpArticles.filter((article) => {
    const haystack = [
      article.title,
      article.module,
      article.audience,
      ...article.keywords,
      ...article.sections.flatMap((section) => [section.title, ...section.content]),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(trimmed);
  });
}
