/**
 * AgentDraft - Work products owned by an agent
 * 
 * Each agent has its own workspace of drafts. These can be referenced
 * from any room the agent participates in.
 * 
 * Stored as: agents/{agentId}/drafts/{draftId}
 */

const { firestore } = require('../config/firebase');
const admin = require('firebase-admin');

class AgentDraft {
  constructor(data = {}) {
    this.id = data.id || null;
    this.agentId = data.agentId || null;
    
    // What type of content is this?
    // 'onboarding_pillar', 'onboarding_principle', 'text', 'structured'
    this.contentType = data.contentType || 'text';
    
    // The actual content (shape depends on contentType)
    this.content = data.content || {};
    
    // Human-readable title/summary
    this.title = data.title || '';
    
    // Draft lifecycle
    // 'draft' -> 'pending_review' -> 'approved' -> 'published'
    // Can also be 'rejected' or 'archived'
    this.status = data.status || 'draft';
    
    // If published, reference to the target entity
    // e.g., { collection: 'onboardingPrinciples', id: 'abc123' }
    this.publishedRef = data.publishedRef || null;
    
    // Which room triggered this draft (for context)
    this.sourceRoomId = data.sourceRoomId || null;
    this.sourceMessageId = data.sourceMessageId || null;
    
    // Timestamps
    this.createdAt = data.createdAt || admin.firestore.Timestamp.now();
    this.updatedAt = data.updatedAt || admin.firestore.Timestamp.now();
    this.reviewedAt = data.reviewedAt || null;
    this.publishedAt = data.publishedAt || null;
    
    // Who reviewed/approved (userId)
    this.reviewedBy = data.reviewedBy || null;
    
    // Review notes
    this.reviewNotes = data.reviewNotes || null;
    
    this.metadata = data.metadata || {};
  }

  /**
   * Get the drafts subcollection for an agent
   */
  static collection(agentId) {
    if (!agentId) {
      throw new Error('agentId is required to access drafts collection');
    }
    return firestore.collection('agents').doc(agentId).collection('drafts');
  }

  /**
   * Create a new draft in an agent's workspace
   */
  static async create(data) {
    if (!data.agentId) {
      throw new Error('agentId is required to create a draft');
    }

    const draft = new AgentDraft(data);
    const docRef = await this.collection(data.agentId).add({
      agentId: draft.agentId,
      contentType: draft.contentType,
      content: draft.content,
      title: draft.title,
      status: draft.status,
      publishedRef: draft.publishedRef,
      sourceRoomId: draft.sourceRoomId,
      sourceMessageId: draft.sourceMessageId,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      reviewedAt: draft.reviewedAt,
      publishedAt: draft.publishedAt,
      reviewedBy: draft.reviewedBy,
      reviewNotes: draft.reviewNotes,
      metadata: draft.metadata
    });

    draft.id = docRef.id;
    return draft;
  }

  /**
   * Find a draft by ID
   */
  static async findById(agentId, draftId) {
    if (!agentId || !draftId) {
      throw new Error('Both agentId and draftId are required');
    }

    const doc = await this.collection(agentId).doc(draftId).get();
    if (!doc.exists) {
      return null;
    }

    return new AgentDraft({ id: doc.id, agentId, ...doc.data() });
  }

  /**
   * Find all drafts for an agent
   */
  static async findByAgentId(agentId, options = {}) {
    if (!agentId) {
      throw new Error('agentId is required');
    }

    // Simple query, filter/sort in memory to avoid index requirements
    const snapshot = await this.collection(agentId).get();
    let drafts = snapshot.docs.map(doc => new AgentDraft({ 
      id: doc.id, 
      agentId, 
      ...doc.data() 
    }));

    // Filter by status in memory
    if (options.status) {
      drafts = drafts.filter(d => d.status === options.status);
    }

    // Filter by content type in memory
    if (options.contentType) {
      drafts = drafts.filter(d => d.contentType === options.contentType);
    }

    // Sort by creation (newest first) in memory
    drafts.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime - aTime;
    });

    // Limit
    if (options.limit) {
      drafts = drafts.slice(0, options.limit);
    }

    return drafts;
  }

  /**
   * Find drafts pending review across all agents
   */
  static async findPendingReview(limit = 50) {
    // This requires a collection group query
    const snapshot = await firestore.collectionGroup('drafts')
      .where('status', '==', 'pending_review')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => {
      // Extract agentId from the path: agents/{agentId}/drafts/{draftId}
      const pathParts = doc.ref.path.split('/');
      const agentId = pathParts[1];
      return new AgentDraft({ id: doc.id, agentId, ...doc.data() });
    });
  }

  /**
   * Save updates to the draft
   */
  async save() {
    if (!this.agentId) {
      throw new Error('agentId is required to save a draft');
    }

    this.updatedAt = admin.firestore.Timestamp.now();

    if (this.id) {
      await AgentDraft.collection(this.agentId).doc(this.id).update({
        contentType: this.contentType,
        content: this.content,
        title: this.title,
        status: this.status,
        publishedRef: this.publishedRef,
        sourceRoomId: this.sourceRoomId,
        sourceMessageId: this.sourceMessageId,
        updatedAt: this.updatedAt,
        reviewedAt: this.reviewedAt,
        publishedAt: this.publishedAt,
        reviewedBy: this.reviewedBy,
        reviewNotes: this.reviewNotes,
        metadata: this.metadata
      });
    } else {
      const created = await AgentDraft.create(this);
      this.id = created.id;
    }

    return this;
  }

  /**
   * Submit draft for review
   */
  async submitForReview() {
    this.status = 'pending_review';
    return this.save();
  }

  /**
   * Approve the draft
   */
  async approve(reviewerId, notes = null) {
    this.status = 'approved';
    this.reviewedAt = admin.firestore.Timestamp.now();
    this.reviewedBy = reviewerId;
    if (notes) this.reviewNotes = notes;
    return this.save();
  }

  /**
   * Reject the draft
   */
  async reject(reviewerId, notes = null) {
    this.status = 'rejected';
    this.reviewedAt = admin.firestore.Timestamp.now();
    this.reviewedBy = reviewerId;
    if (notes) this.reviewNotes = notes;
    return this.save();
  }

  /**
   * Mark as published with reference to target entity
   */
  async markPublished(publishedRef) {
    this.status = 'published';
    this.publishedAt = admin.firestore.Timestamp.now();
    this.publishedRef = publishedRef;
    return this.save();
  }

  /**
   * Delete the draft
   */
  async delete() {
    if (!this.agentId || !this.id) {
      throw new Error('Both agentId and id are required to delete a draft');
    }
    await AgentDraft.collection(this.agentId).doc(this.id).delete();
  }

  /**
   * Convert to JSON for API responses
   */
  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      contentType: this.contentType,
      content: this.content,
      title: this.title,
      status: this.status,
      publishedRef: this.publishedRef,
      sourceRoomId: this.sourceRoomId,
      sourceMessageId: this.sourceMessageId,
      createdAt: this.createdAt?.toDate ? this.createdAt.toDate().toISOString() :
                 this.createdAt?.toISOString ? this.createdAt.toISOString() :
                 this.createdAt,
      updatedAt: this.updatedAt?.toDate ? this.updatedAt.toDate().toISOString() :
                 this.updatedAt?.toISOString ? this.updatedAt.toISOString() :
                 this.updatedAt,
      reviewedAt: this.reviewedAt?.toDate ? this.reviewedAt.toDate().toISOString() :
                  this.reviewedAt?.toISOString ? this.reviewedAt.toISOString() :
                  this.reviewedAt,
      publishedAt: this.publishedAt?.toDate ? this.publishedAt.toDate().toISOString() :
                   this.publishedAt?.toISOString ? this.publishedAt.toISOString() :
                   this.publishedAt,
      reviewedBy: this.reviewedBy,
      reviewNotes: this.reviewNotes,
      metadata: this.metadata
    };
  }
}

module.exports = AgentDraft;

