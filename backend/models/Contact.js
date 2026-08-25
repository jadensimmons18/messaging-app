import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
    {
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'accepted'],
            default: 'pending',
        },
    },
    {timestamps: true}
)

contactSchema.index({ requestedBy: 1 });
contactSchema.index({ recipient: 1 });

export default mongoose.model('Contact', contactSchema);