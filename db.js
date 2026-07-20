// db.js
// Sets up the SQLite database for the demo bank project.
// This is a TEACHING DEMO ONLY: no real money, no real payment processor.
// Balances here are just numbers in a local database file (bank.db).
// Uses Node's BUILT-IN sqlite module (node:sqlite) — no native compilation needed.

const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'bank.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    full_name TEXT,
    account_number TEXT,
    balance REAL NOT NULL DEFAULT 0,
    total_credit REAL NOT NULL DEFAULT 0,
    total_charge REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS loan_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    term TEXT NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS balance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    changed_by TEXT NOT NULL,      -- admin username who made the change
    field TEXT NOT NULL DEFAULT 'balance', -- 'balance' (checking) or 'savings_balance'
    old_balance REAL NOT NULL,
    new_balance REAL NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    icon TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

function tryAlter(sql) {
  try { db.exec(sql); } catch (e) { /* column already exists — fine */ }
}

tryAlter(`ALTER TABLE users ADD COLUMN savings_balance REAL NOT NULL DEFAULT 0`);
tryAlter(`ALTER TABLE users ADD COLUMN savings_account_number TEXT`);
tryAlter(`ALTER TABLE balance_log ADD COLUMN field TEXT NOT NULL DEFAULT 'balance'`);
tryAlter(`ALTER TABLE blog_posts ADD COLUMN image TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN full_name TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN date_of_birth TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN account_last4 TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN employment_status TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN income_range TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN phone_number TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN country TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN state TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN city TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN signature TEXT`);
tryAlter(`ALTER TABLE loan_requests ADD COLUMN loan_type TEXT`);

function seedUsers() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (existing.c > 0) {
    console.log('Users already exist, skipping user seed.');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO users (username, password_hash, role, full_name, account_number, balance, total_credit, total_charge, savings_balance, savings_account_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    'admin',
    bcrypt.hashSync('admin123', 10),
    'admin',
    'Bank Administrator',
    null,
    0, 0, 0, 0, null
  );

  insert.run(
    'demo',
    bcrypt.hashSync('demo123', 10),
    'user',
    'Demo User',
    '****1820',
    2000000.00,
    2000000.00,
    0.00,
    500000.00,
    '****2045'
  );

  console.log('Seeded database with:');
  console.log('  admin / admin123  (role: admin)');
  console.log('  demo  / demo123   (role: user)');
}

function seedBlogPosts() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM blog_posts').get();
  if (existing.c > 0) {
    console.log('Blog posts already exist, skipping blog seed.');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO blog_posts (slug, title, category, icon, excerpt, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const posts = [
    {
      slug: 'five-simple-ways-to-start-saving',
      title: '5 Simple Ways to Start Saving This Month',
      category: 'Savings Tips',
      icon: '💰',
      excerpt: 'Small habits add up. Here are five practical ways to start building your savings today, no matter your income.',
      content: `Saving money doesn't have to mean drastic lifestyle changes. Small, consistent habits often make the biggest long-term difference.

Start by automating a fixed amount into your savings account right after payday, before you have a chance to spend it. Even a modest amount adds up significantly over a year.

Next, track your subscriptions. Many people pay for services they've forgotten about entirely. A quick monthly review can free up cash you didn't know you were losing.

Set a specific savings goal — a number and a date. Vague goals like "save more" rarely stick, but "save $500 by December" gives you something concrete to work toward.

Consider a separate savings account, distinct from your everyday checking account. Out of sight often means out of mind, which makes it easier to leave the money untouched.

Finally, review your progress monthly. Small check-ins keep the habit alive and let you celebrate progress along the way.`
    },
    {
      slug: 'understanding-loan-terms',
      title: 'Understanding Loan Terms Before You Borrow',
      category: 'Loans',
      icon: '📄',
      excerpt: "Before you request a loan, it helps to understand exactly what you're agreeing to. Here's a plain-language breakdown.",
      content: `Loans can be a useful tool, but only when you understand exactly what you're signing up for.

The "term" of a loan refers to how long you have to repay it. Shorter terms usually mean higher monthly payments but less paid overall, while longer terms spread payments out but often cost more over time.

Interest is the cost of borrowing, usually expressed as a percentage. Always check whether a rate is fixed (stays the same for the life of the loan) or variable (can change over time).

The "purpose" of a loan matters too — lenders often want to know what the funds will be used for, whether that's education, a major purchase, or consolidating other debt.

Before requesting a loan, it's worth asking yourself three questions: Can I comfortably afford the monthly payment? Do I understand the full repayment timeline? And is this the right time to borrow, or could I wait and save instead?

A little research before borrowing goes a long way toward making loans work for you, not against you.`
    },
    {
      slug: 'how-to-spot-a-phishing-scam',
      title: "How to Spot a Phishing Scam Before It's Too Late",
      category: 'Security',
      icon: '🔒',
      excerpt: 'Phishing attempts are getting more convincing. Here are the warning signs to watch for in emails, texts, and calls.',
      content: `Phishing scams have become significantly more sophisticated, often mimicking real banks and businesses convincingly. Knowing the warning signs can protect you.

Urgency is a major red flag. Messages that pressure you to act immediately — "your account will be locked in 24 hours" — are designed to make you panic before you think clearly.

Check the sender carefully. Scammers often use email addresses or phone numbers that look almost right but contain small differences from the real thing.

Be cautious with links. Rather than clicking a link in an unexpected message, go directly to the official website or app yourself and log in from there.

Legitimate banks will never ask for your full password, PIN, or one-time verification code over phone, email, or text. If anyone asks for these, treat it as an immediate red flag.

When in doubt, pause. Scammers rely on quick, emotional reactions. Taking a moment to verify independently is one of the most effective ways to stay safe.`
    },
    {
      slug: 'budgeting-101',
      title: "Budgeting 101: Building a Plan That Actually Works",
      category: 'Budgeting',
      icon: '📊',
      excerpt: 'Most budgets fail because they’re too rigid. Here’s a simpler approach that’s easier to stick with long term.',
      content: `A budget only works if you can actually stick to it. Overly strict budgets often collapse within a few weeks, which is why a flexible approach tends to last longer.

Start with the essentials: housing, utilities, groceries, transportation. These are non-negotiable, so they come first in your plan.

Next, set aside a fixed percentage for savings before anything else — treating it like a required expense rather than an afterthought makes a real difference.

For everything else, give yourself a realistic, flexible spending category rather than tracking every individual purchase down to the cent. Precision is less important than consistency.

Review your budget monthly, not daily. Checking too often can feel discouraging, while a monthly check-in gives you enough perspective to make meaningful adjustments.

Most importantly, expect imperfection. A budget isn't about never overspending — it's about noticing patterns over time and gradually improving them.`
    },
    {
      slug: 'why-a-separate-savings-account-matters',
      title: 'Why a Separate Savings Account Makes a Difference',
      category: 'Savings Tips',
      icon: '💰',
      excerpt: 'Keeping savings separate from everyday spending is a small change with a surprisingly large impact.',
      content: `It might seem like a minor detail, but keeping your savings in a separate account from your everyday spending can significantly change your financial habits.

When savings sit in the same account as your daily spending money, it's easy to dip into them without really noticing — a few small withdrawals here and there can quietly erode your progress.

A separate account creates a small amount of friction. That extra step of transferring money before spending it is often enough to make you pause and reconsider.

It also makes tracking progress much clearer. Watching a dedicated savings balance grow over time is motivating in a way that a mixed, fluctuating balance simply isn't.

Finally, a separate account helps you mentally categorize your money — this portion is for today, this portion is for the future. That distinction alone can shift how you think about spending decisions.`
    },
    {
      slug: 'introducing-the-new-dashboard',
      title: 'Introducing the New Velnora Finance Dashboard',
      category: 'Company News',
      icon: '📢',
      excerpt: "We've redesigned the dashboard from the ground up. Here's what's new and why we built it this way.",
      content: `We're excited to share a redesigned dashboard built around a simple idea: your account information should be clear at a glance, without digging through menus.

The new balance card sits front and center, showing exactly where things stand the moment you log in. A swipeable layout lets you move between your checking and savings balances without leaving the main screen.

We've also reorganized the action buttons — transfers, withdrawals, and loan requests are now grouped logically, so the most common actions are always within easy reach.

Behind the scenes, every balance change is now logged with a timestamp and reason, giving you a clear, transparent record of your account activity over time.

This redesign is just the first step. We're continuing to refine the dashboard based on what makes everyday banking simpler, and we'll keep sharing updates as new features roll out.`
    },
    {
      slug: 'now-supporting-checking-and-savings',
      title: 'Velnora Finance Now Supports Savings + Checking Accounts',
      category: 'Product Update',
      icon: '✨',
      excerpt: "You can now manage both a checking and a savings account from the same dashboard. Here's how it works.",
      content: `Managing your money often means juggling multiple accounts for different purposes. That's why we've added full support for both checking and savings accounts within a single Velnora Finance dashboard.

Your checking account remains built for everyday spending — transfers, withdrawals, and regular activity all flow through it as before.

Your new savings account sits alongside it, with its own dedicated balance and account number, designed for money you're setting aside rather than spending day to day.

Switching between the two is simple: a swipeable card on your dashboard lets you move from one balance to the other with a quick gesture, no extra menus required.

This is part of our broader goal of making it easier to organize your finances in one place, rather than needing separate logins or separate apps for spending and saving.`
    },
    {
      slug: 'our-commitment-to-security',
      title: 'Our Commitment to Keeping Your Account Secure',
      category: 'Company News',
      icon: '📢',
      excerpt: 'Security is a foundation, not an afterthought. Here’s an inside look at how we approach protecting your account.',
      content: `Trust is at the center of everything we build, and that starts with how seriously we treat account security.

Every password is stored using industry-standard hashing, meaning even we never see or store your actual password in readable form.

Every balance change on your account — whether a deposit, withdrawal, or adjustment — is logged with a timestamp, so there's always a clear, auditable record of what happened and when.

We're also continuing to invest in features like activity notifications, so you're always aware of what's happening on your account without needing to check manually.

Security isn't a one-time project for us; it's an ongoing commitment. As we grow, we'll keep sharing updates on the steps we're taking to keep your account, and your trust, protected.`
    }
  ];

  posts.forEach(p => {
    insert.run(p.slug, p.title, p.category, p.icon, p.excerpt, p.content);
  });

  console.log(`Seeded ${posts.length} blog posts.`);
}

function setPostImages() {
  const images = {
    'five-simple-ways-to-start-saving': 'savings.png',
    'understanding-loan-terms': 'loans.png',
    'how-to-spot-a-phishing-scam': 'phishing.png',
    'budgeting-101': 'budgetting.png',
    'why-a-separate-savings-account-matters': 'savings-tip.png',
    'introducing-the-new-dashboard': 'dashboard.png',
    'now-supporting-checking-and-savings': 'update.png',
    'our-commitment-to-security': 'company.png'
  };
  const stmt = db.prepare('UPDATE blog_posts SET image = ? WHERE slug = ?');
  Object.entries(images).forEach(([slug, filename]) => stmt.run(filename, slug));
  console.log('Blog post images assigned.');
}

function seed() {
  seedUsers();
  seedBlogPosts();
  setPostImages();
}
 

if (require.main === module) {
  seed();
}

module.exports = db;