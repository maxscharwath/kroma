import { Table, type TableHeading, useT } from '@kroma/module-sdk';

/** The queue's heading band, where a sortable column's whole cell is the
 *  control. */
export function DownloadTableHead({ headings }: Readonly<{ headings: TableHeading[] }>) {
  const t = useT();
  return (
    <Table.Header>
      {headings.map(({ id, label, wide, sorted, onSortPress }) => (
        <Table.Column key={id} wide={wide} sorted={sorted} onSortPress={onSortPress}>
          {label ? t(label) : null}
        </Table.Column>
      ))}
    </Table.Header>
  );
}
