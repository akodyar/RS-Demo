import React from 'react';
import { WorkspaceSwitcherModal, WorkspaceSwitcherModalProps } from '../common/WorkspaceSwitcherModal';

export type TenantWorkspaceSwitcherModalProps = WorkspaceSwitcherModalProps;

export const TenantWorkspaceSwitcherModal: React.FC<TenantWorkspaceSwitcherModalProps> = (props) => {
  return <WorkspaceSwitcherModal {...props} />;
};

export default TenantWorkspaceSwitcherModal;

