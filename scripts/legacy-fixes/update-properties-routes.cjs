const fs = require('fs');
let s = fs.readFileSync('src/server/routes/properties.ts', 'utf8');

s = s.replace(/router\.post\('\/', requireAuth, async \(req, res\) => \{[\s\S]*?\}\);/, `router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, type, address } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: "Missing required property fields" });
    }

    const newProperty = await propertyRepository.createProperty(req.user!.id, { name, type, address });
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CREATE_PROPERTY',
      resourceType: 'Property',
      resourceId: newProperty.id,
      ipAddress: (req.ip || "") as string
    });

    res.status(201).json(newProperty);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create property" });
  }
});`);

s = s.replace(/router\.put\('\/:propertyId', requireAuth, requirePropertyPermission\(Permission\.EDIT_PROPERTY\), async \(req, res\) => \{[\s\S]*?\}\);/, `router.put('/:propertyId', requireAuth, requirePropertyPermission(Permission.EDIT_PROPERTY), async (req, res) => {
  try {
    const propertyId = req.params.propertyId;
    const updates = req.body;
    
    const updated = await propertyRepository.updateProperty(propertyId, updates);
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'UPDATE_PROPERTY',
      resourceType: 'Property',
      resourceId: propertyId,
      changes: updates,
      ipAddress: (req.ip || "") as string
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update property" });
  }
});`);

fs.writeFileSync('src/server/routes/properties.ts', s);
