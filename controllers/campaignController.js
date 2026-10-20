import Campaign from "../models/Campaign.js";
import Order from "../models/Order.js";

const escape = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const text = (value, max) => String(value ?? "").trim().slice(0, max);

const phaseOf = (campaign, now) => {
  if (campaign.endsAt <= now) return "past";
  if (campaign.startsAt > now) return "future";
  return "current";
};

export const saveCampaign = async (req, res) => {
  try {
    const body = req.body || {};
    const startsAt = new Date(body.starts_at);
    const endsAt = new Date(body.ends_at);
    const target = Number(body.target_deliveries);
    const reward = Number(body.reward_amount);

    if (!text(body.title, 120)) {
      return res.status(400).json({ message: "title is required" });
    }

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return res.status(400).json({ message: "ends_at must be after starts_at" });
    }

    if (!(target >= 1) || !(reward >= 0)) {
      return res.status(400).json({ message: "target_deliveries and reward_amount are required" });
    }

    const campaign = await Campaign.findOneAndUpdate(
      { platform: req.platform._id, externalId: text(req.params.externalId, 100) },
      {
        title: text(body.title, 120),
        description: text(body.description, 1000),
        startsAt,
        endsAt,
        targetDeliveries: target,
        rewardAmount: reward,
        currency: text(body.currency, 10) || "NGN",
        areaLabel: text(body.area_label, 120),
        areaWords: Array.isArray(body.area_words) ? body.area_words.map((w) => text(w, 60).toLowerCase()).filter(Boolean).slice(0, 200) : [],
        active: body.active !== false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ id: campaign.externalId, saved: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    await Campaign.deleteOne({ platform: req.platform._id, externalId: text(req.params.externalId, 100) });

    return res.json({ deleted: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const courierCampaigns = async (req, res) => {
  try {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const campaigns = await Campaign.find({ active: true, endsAt: { $gte: since } })
      .sort({ startsAt: 1 })
      .lean();

    const groups = { current: [], future: [], past: [] };

    for (const campaign of campaigns) {
      const phase = phaseOf(campaign, now);
      let progress = 0;

      if (phase !== "future") {
        const filter = {
          courier: req.user.id,
          platform: campaign.platform,
          status: "delivered",
          statusChangedAt: { $gte: campaign.startsAt, $lt: campaign.endsAt },
        };

        if (campaign.areaWords?.length) {
          filter.pickupAddress = { $regex: `\\b(${campaign.areaWords.map(escape).join("|")})\\b`, $options: "i" };
        }

        progress = await Order.countDocuments(filter);
      }

      groups[phase].push({
        id: campaign.externalId,
        title: campaign.title,
        description: campaign.description,
        starts_at: campaign.startsAt,
        ends_at: campaign.endsAt,
        target_deliveries: campaign.targetDeliveries,
        reward_amount: campaign.rewardAmount,
        currency: campaign.currency,
        area_label: campaign.areaLabel,
        progress,
        reached: progress >= campaign.targetDeliveries,
      });
    }

    groups.past.reverse();

    return res.json(groups);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
