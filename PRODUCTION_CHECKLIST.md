# POS Production Readiness Checklist

## 🔒 Security Checklist

### Pre-Launch
- [ ] Change all default passwords
- [ ] Generate unique JWT_SECRET (32+ characters)
- [ ] Set CORS_ORIGINS to exact production URLs only
- [ ] Enable HTTPS on all endpoints
- [ ] Remove console.log statements in production
- [ ] Set NODE_ENV=production

### Database Security
- [ ] Enable RLS on all Supabase tables
- [ ] Verify service role key is NOT exposed to frontend
- [ ] Create database user with minimal required permissions
- [ ] Enable SSL for database connections
- [ ] Set strong database password (20+ characters)

### API Security
- [ ] Rate limiting enabled (100 req/15min default)
- [ ] Helmet middleware active (security headers)
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection in responses

### Access Control
- [ ] Test all RBAC permissions work correctly
- [ ] Verify Super Admin is the only user initially
- [ ] Confirm branch isolation working
- [ ] Test logout clears all tokens

---

## 💾 Data Backup Strategy

### Automated Backups
| Type | Frequency | Retention | Method |
|------|-----------|-----------|--------|
| Full DB | Daily | 30 days | Supabase PITR |
| Transaction logs | Hourly | 7 days | Supabase |
| Manual export | Weekly | 90 days | pg_dump to cloud |

### Backup Procedures
```bash
# Manual backup command
pg_dump $DATABASE_URL -F c -f backup_$(date +%Y%m%d).dump

# Restore command
pg_restore -d $DATABASE_URL backup_file.dump
```

### Backup Verification
- [ ] Test restore process monthly
- [ ] Verify backup integrity after each backup
- [ ] Store backups in different region than primary
- [ ] Document recovery time objective (RTO): 4 hours
- [ ] Document recovery point objective (RPO): 1 hour

---

## 👤 User Onboarding Steps

### 1. Create Branch
```sql
INSERT INTO branches (code, name, address, is_active)
VALUES ('HQ', 'Main Store', '123 Main St', true);
```

### 2. Create Warehouse
```sql
INSERT INTO warehouses (branch_id, code, name, is_default)
SELECT id, 'MAIN', 'Main Warehouse', true FROM branches WHERE code = 'HQ';
```

### 3. Create User Account
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add User" → Enter email/password
3. Run SQL to create profile:
```sql
INSERT INTO users (auth_id, email, full_name, branch_id)
VALUES ('<auth_id>', 'user@company.com', 'User Name', '<branch_id>');
```

### 4. Assign Role
```sql
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.email = 'user@company.com' AND r.name = 'Cashier';
```

### 5. Set PIN (Optional)
```sql
UPDATE users SET pin_code = '1234' WHERE email = 'user@company.com';
```

### 6. User Training Checklist
- [ ] Login and navigation
- [ ] POS: Adding items, discounts, payments
- [ ] Customer lookup and creation
- [ ] Work order creation
- [ ] End of day procedures

---

## 📋 Daily Operation SOP

### Opening Shift
1. **Login** to POS system
2. **Open Cash Session**
   - Go to Cash → Open Session
   - Count opening drawer amount
   - Enter opening balance
3. **Verify inventory** (spot check 5 items)
4. **Check pending work orders**

### During Shift
1. Complete sales through POS
2. Process returns with manager approval
3. Create work orders for repairs
4. Handle customer inquiries
5. **Every 2 hours**: Check cash drawer matches system

### Closing Shift
1. **Final sale**: Ensure no pending transactions
2. **Close Cash Session**
   - Count physical cash
   - Enter closing amount
   - Note any discrepancies
3. **Generate Reports**
   - Daily sales summary
   - Cash movement report
4. **Backup**: System auto-backs up nightly
5. **Logout** of all stations

### Weekly Tasks
| Day | Task |
|-----|------|
| Monday | Inventory count |
| Wednesday | Review reports |
| Friday | Clear completed work orders |
| Saturday | Backup verification |

---

## 📈 Scaling Plan

### Current Capacity (Starter Tier)
- Render: 512 MB RAM, shared CPU
- Supabase: 500 MB storage, 2 GB transfer
- Vercel: 100 GB bandwidth

### Performance Thresholds
| Metric | Current Limit | Action When Reached |
|--------|---------------|---------------------|
| Daily transactions | 500 | Upgrade Render to Standard |
| Concurrent users | 50 | Add Redis caching |
| Database size | 400 MB | Upgrade Supabase plan |
| API response time | > 2 sec | Optimize queries, add indexes |

### Scaling Tiers

**Tier 1: Small Business** (Current)
- 1-2 branches
- Up to 5 concurrent users
- ~$25/month total

**Tier 2: Growing Business**
- 3-10 branches
- Up to 20 concurrent users
- Add: Redis cache, CDN
- ~$75/month total

**Tier 3: Enterprise**
- 10+ branches
- 50+ concurrent users
- Add: Load balancer, dedicated DB
- ~$300/month total

### Scaling Actions
```
If API latency > 1 sec:
  → Add database indexes
  → Enable query caching

If Render CPU > 80%:
  → Upgrade to Standard plan
  → Add horizontal scaling

If concurrent users > 30:
  → Add Redis for sessions
  → Enable connection pooling

If database > 1 GB:
  → Archive old transactions
  → Upgrade Supabase plan
```

---

## ✅ Go-Live Checklist

### 48 Hours Before
- [ ] Run full system test
- [ ] Verify all env vars set correctly
- [ ] Test backup and restore
- [ ] Train all users
- [ ] Prepare rollback plan

### 24 Hours Before
- [ ] Final data migration
- [ ] DNS propagation check
- [ ] SSL certificate verification
- [ ] Load test with expected traffic

### Launch Day
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Standby for support calls
- [ ] Document any issues

### Post-Launch
- [ ] Collect user feedback (Day 1)
- [ ] Review error logs (Day 1-3)
- [ ] Performance audit (Week 1)
- [ ] Backup verification (Week 1)
