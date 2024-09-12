import { relations } from 'drizzle-orm';
import { zuvyModuleForm } from '../table/zuvyModuleForm';
import { zuvyFormTracking } from '../table/zuvyFormTracking';

export const formModuleRelation = relations(
  zuvyModuleForm,
  ({ many }) => ({
    formTrackingData: many(zuvyFormTracking),
  })
);
