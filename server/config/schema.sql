-- ====================================================================
-- OmniReach - OmniChannel Campaigns & Broadcast Center Database Schema
-- Database: BroadcastEngine (PostgreSQL 18+)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS & RBAC TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'operator')),
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    permissions JSONB DEFAULT '{"all_access": true}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_name);

-- 3. OMNIREACH LEADS REPOSITORY (Ground truth for Customer URN mapping)
CREATE TABLE IF NOT EXISTS leads_repository (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    urn VARCHAR(50) UNIQUE NOT NULL,
    application_id VARCHAR(50),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    pan_no VARCHAR(20),
    city VARCHAR(100),
    employment VARCHAR(100),
    income_range VARCHAR(50),
    card_name VARCHAR(100),
    card_bank VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leads_repo_phone ON leads_repository(phone);
CREATE INDEX IF NOT EXISTS idx_leads_repo_email ON leads_repository(email);
CREATE INDEX IF NOT EXISTS idx_leads_repo_urn ON leads_repository(urn);

-- 4. MASTER DATA CENTER (Zero-Duplicate Contact Repository)
CREATE TABLE IF NOT EXISTS campaign_master_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    urn VARCHAR(50),
    fmcb_id VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    email VARCHAR(255),
    address TEXT,
    pan_no VARCHAR(20),
    city VARCHAR(100),
    custom_attributes JSONB DEFAULT '{}'::jsonb,
    whatsapp_optin BOOLEAN DEFAULT TRUE,
    email_optin BOOLEAN DEFAULT TRUE,
    whatsapp_sent_count INT DEFAULT 0,
    whatsapp_delivered_count INT DEFAULT 0,
    email_sent_count INT DEFAULT 0,
    email_delivered_count INT DEFAULT 0,
    clicked_count INT DEFAULT 0,
    last_broadcast_id UUID,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_master_leads_has_contact CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_leads_phone ON campaign_master_leads(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_leads_email ON campaign_master_leads(LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_leads_urn ON campaign_master_leads(urn);
CREATE INDEX IF NOT EXISTS idx_master_leads_fmcb ON campaign_master_leads(fmcb_id);
CREATE INDEX IF NOT EXISTS idx_master_leads_company ON campaign_master_leads(company_name);
CREATE INDEX IF NOT EXISTS idx_master_leads_last_broadcast ON campaign_master_leads(last_broadcast_id);

-- Sequence for FMCB Sequential IDs
CREATE SEQUENCE IF NOT EXISTS fmcb_id_seq START WITH 1 INCREMENT BY 1;

-- 5. MULTI-GATEWAY INFRASTRUCTURE
CREATE TABLE IF NOT EXISTS gateways_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    type VARCHAR(50) NOT NULL CHECK (type IN ('whatsapp_meta', 'whatsapp_baileys', 'email_ses', 'email_smtp', 'email_resend')),
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    quality_rating VARCHAR(30) DEFAULT 'GREEN' CHECK (quality_rating IN ('GREEN', 'YELLOW', 'RED', 'UNKNOWN')),
    status_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gateways_company ON gateways_config(company_name);

-- 6. TEMPLATES (WhatsApp Meta Graph & Email Studios)
CREATE TABLE IF NOT EXISTS campaign_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'email')),
    category VARCHAR(50) DEFAULT 'MARKETING' CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    meta_template_name VARCHAR(255),
    meta_language VARCHAR(20) DEFAULT 'en_US',
    meta_status VARCHAR(50) DEFAULT 'APPROVED' CHECK (meta_status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED')),
    header_type VARCHAR(50) DEFAULT 'NONE' CHECK (header_type IN ('NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT')),
    header_content TEXT,
    body_content TEXT NOT NULL,
    footer_content TEXT,
    buttons_json JSONB DEFAULT '[]'::jsonb,
    email_subject VARCHAR(500),
    email_html TEXT,
    dynamic_tokens JSONB DEFAULT '["name", "contact", "mail", "address", "id", "unsubscribe_url", "contact_center_url"]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_templates_company ON campaign_templates(company_name);

-- 7. BROADCAST CAMPAIGNS MANAGER
CREATE TABLE IF NOT EXISTS campaign_broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    description TEXT,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'email', 'both')),
    tags TEXT[] DEFAULT '{}',
    whatsapp_gateway_id UUID REFERENCES gateways_config(id) ON DELETE SET NULL,
    email_gateway_id UUID REFERENCES gateways_config(id) ON DELETE SET NULL,
    whatsapp_template_id UUID REFERENCES campaign_templates(id) ON DELETE SET NULL,
    email_template_id UUID REFERENCES campaign_templates(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'processing', 'completed', 'failed', 'paused')),
    execution_mode VARCHAR(50) DEFAULT 'immediate' CHECK (execution_mode IN ('immediate', 'scheduled')),
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cooldown_until TIMESTAMP WITH TIME ZONE,
    total_target_count INT DEFAULT 0,
    whatsapp_sent INT DEFAULT 0,
    whatsapp_delivered INT DEFAULT 0,
    whatsapp_read INT DEFAULT 0,
    whatsapp_failed INT DEFAULT 0,
    email_sent INT DEFAULT 0,
    email_delivered INT DEFAULT 0,
    email_opened INT DEFAULT 0,
    email_failed INT DEFAULT 0,
    total_suppressed INT DEFAULT 0,
    total_clicks INT DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON campaign_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_company ON campaign_broadcasts(company_name);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled_at ON campaign_broadcasts(scheduled_at);

-- 8. AUDIT & DELIVERY LOGS
CREATE TABLE IF NOT EXISTS campaign_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id UUID NOT NULL REFERENCES campaign_broadcasts(id) ON DELETE CASCADE,
    master_lead_id UUID NOT NULL REFERENCES campaign_master_leads(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'email')),
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'opened', 'clicked', 'failed', 'suppressed')),
    error_message TEXT,
    meta_message_id VARCHAR(255),
    ses_message_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_broadcast ON campaign_logs(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_lead ON campaign_logs(master_lead_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_status ON campaign_logs(status);

-- 9. UNIVERSAL CTR TRACKING
CREATE TABLE IF NOT EXISTS ctr_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broadcast_id UUID REFERENCES campaign_broadcasts(id) ON DELETE SET NULL,
    master_lead_id UUID REFERENCES campaign_master_leads(id) ON DELETE SET NULL,
    destination_url TEXT NOT NULL,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ctr_broadcast ON ctr_clicks(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_ctr_lead ON ctr_clicks(master_lead_id);

-- 10. ADMIN ACTION AUDIT LOGS
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON admin_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_logs(action);

-- 11. JOURNEY BUILDER & AUTOMATION ENGINE
CREATE TABLE IF NOT EXISTS journeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    description TEXT,
    category VARCHAR(100) DEFAULT 'CUSTOMER_LIFECYCLE',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    trigger_config JSONB DEFAULT '{"type": "segment_entry", "filter": "all"}'::jsonb,
    nodes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    edges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    stats_json JSONB DEFAULT '{"total_enrolled": 0, "currently_active": 0, "completed": 0, "dropped": 0, "conversions": 0}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON journeys(status);
CREATE INDEX IF NOT EXISTS idx_journeys_category ON journeys(category);
CREATE INDEX IF NOT EXISTS idx_journeys_company ON journeys(company_name);

CREATE TABLE IF NOT EXISTS journey_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    master_lead_id UUID NOT NULL REFERENCES campaign_master_leads(id) ON DELETE CASCADE,
    current_node_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'dropped')),
    variables_json JSONB DEFAULT '{}'::jsonb,
    next_execution_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journey_enrollments_status ON journey_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_journey_enrollments_next ON journey_enrollments(next_execution_at);
CREATE INDEX IF NOT EXISTS idx_journey_enrollments_journey ON journey_enrollments(journey_id);

CREATE TABLE IF NOT EXISTS journey_step_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
    enrollment_id UUID NOT NULL REFERENCES journey_enrollments(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(100) NOT NULL,
    action_taken VARCHAR(255) NOT NULL,
    channel VARCHAR(50),
    status VARCHAR(50) DEFAULT 'success',
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_journey_logs_journey ON journey_step_logs(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_logs_enrollment ON journey_step_logs(enrollment_id);

-- 12. WHATSAPP MULTI-AGENT LIVE CHAT INBOX
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    master_lead_id UUID REFERENCES campaign_master_leads(id) ON DELETE SET NULL,
    phone VARCHAR(30) NOT NULL,
    contact_name VARCHAR(255) NOT NULL DEFAULT 'WhatsApp Customer',
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'bot_handling', 'pending', 'resolved')),
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    priority VARCHAR(30) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tags TEXT[] DEFAULT '{"lead"}',
    unread_count INT DEFAULT 0,
    last_message_text TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    session_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_company ON conversations(company_name);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_lead ON conversations(master_lead_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at);

-- 13. CHAT MESSAGES STREAM & AUDIT
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    whatsapp_message_id VARCHAR(255),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    sender_type VARCHAR(30) NOT NULL CHECK (sender_type IN ('customer', 'agent', 'bot', 'system')),
    sender_id VARCHAR(255),
    sender_name VARCHAR(255) NOT NULL DEFAULT 'Agent',
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'document', 'template', 'interactive_button', 'interactive_list', 'note')),
    content TEXT NOT NULL,
    media_url TEXT,
    template_name VARCHAR(255),
    status VARCHAR(30) DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_wamid ON chat_messages(whatsapp_message_id);

-- 14. CANNED RESPONSES & QUICK REPLIES
CREATE TABLE IF NOT EXISTS canned_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) DEFAULT 'OmniReach Global',
    shortcut VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_canned_company ON canned_responses(company_name);
CREATE INDEX IF NOT EXISTS idx_canned_shortcut ON canned_responses(shortcut);

