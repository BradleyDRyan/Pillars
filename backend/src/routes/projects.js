const express = require('express');
const router = express.Router();
const { Project, Conversation, UserTask, Entry, Thought } = require('../models');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

router.get('/', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const projects = await Project.findByUserId(req.user.uid, includeArchived);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/default', async (req, res) => {
  try {
    let defaultProject = await Project.findDefaultProject(req.user.uid);
    if (!defaultProject) {
      defaultProject = await Project.createDefaultProject(req.user.uid);
    }
    res.json(defaultProject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const stats = await project.updateStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/conversations', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const conversations = await Conversation.findByUserId(req.user.uid, req.params.id);
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/tasks', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const filters = {
      projectId: req.params.id,
      status: req.query.status,
      priority: req.query.priority
    };
    
    const tasks = await UserTask.findByUserId(req.user.uid, filters);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/entries', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const filters = {
      projectId: req.params.id,
      type: req.query.type,
      mood: req.query.mood
    };
    
    const entries = await Entry.findByUserId(req.user.uid, filters);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/thoughts', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const filters = {
      projectId: req.params.id,
      type: req.query.type,
      category: req.query.category
    };
    
    const thoughts = await Thought.findByUserId(req.user.uid, filters);
    res.json(thoughts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.body.isDefault) {
      const existingDefault = await Project.findDefaultProject(req.user.uid);
      if (existingDefault) {
        existingDefault.isDefault = false;
        await existingDefault.save();
      }
    }
    
    const project = await Project.create({
      ...req.body,
      userId: req.user.uid
    });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (req.body.isDefault && !project.isDefault) {
      const existingDefault = await Project.findDefaultProject(req.user.uid);
      if (existingDefault && existingDefault.id !== project.id) {
        existingDefault.isDefault = false;
        await existingDefault.save();
      }
    }
    
    Object.assign(project, req.body);
    await project.save();
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/archive', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.isDefault) {
      return res.status(400).json({ error: 'Cannot archive default project' });
    }
    
    await project.archive();
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/unarchive', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    await project.unarchive();
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || project.userId !== req.user.uid) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default project' });
    }
    
    await project.delete();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

