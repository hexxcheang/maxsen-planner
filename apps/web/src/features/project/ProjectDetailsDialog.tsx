import type { Project } from '@maxsen/domain';
import { Button, Dialog, useToast } from '@/components/ui';
import { useActions } from '@/lib/data/hooks';
import { ProjectDetailsForm } from './ProjectDetailsForm';

interface ProjectDetailsDialogProps {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailsDialog({ project, open, onOpenChange }: ProjectDetailsDialogProps) {
  const actions = useActions();
  const { toast } = useToast();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Project details"
      description="Customer fields can be shown or hidden on each export."
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="project-details" variant="primary">
            Save details
          </Button>
        </>
      }
    >
      {open && (
        <ProjectDetailsForm
          id="project-details"
          initial={project}
          onSubmit={(details) => {
            actions.updateProjectDetails(project.id, details);
            onOpenChange(false);
            toast({ title: 'Project details saved' });
          }}
        />
      )}
    </Dialog>
  );
}
