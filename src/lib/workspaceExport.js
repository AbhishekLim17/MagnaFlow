// "Export everything": one workbook with a sheet per kind of record, so an organisation can
// take its data with it (or keep its own copy) without asking anyone.
import { tasksToRows } from './taskCsv';
import { roleLabel } from './taskLabels';
import { toDate } from './format';
import { downloadBlob } from './csv';

const day = (value) => {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : '';
};

/**
 * The sheets, as plain rows (header first). Pure, so it can be tested without Excel.
 *
 * @param {Object} data
 * @param {Object[]} data.tasks
 * @param {Object[]} data.people        user documents ({id,name,email,role,designation,departmentIds,projectIds,status,phone,createdAt})
 * @param {Object[]} data.projects      ({id,name,departmentId,status,createdAt})
 * @param {Object[]} data.departments   ({id,name,createdAt})
 * @param {Object[]} data.designations  ({id,name,description})
 * @param {Object} meta
 * @param {string} [meta.organisation]
 * @param {string} [meta.exportedBy]
 * @param {Date} [meta.now]
 * @param {boolean} [meta.tasksTruncated] the task list hit its read limit
 * @returns {{ name: string, rows: Array<Array<string|number>> }[]}
 */
export const buildWorkspaceSheets = (data, meta = {}) => {
  const people = data.people || [];
  const projects = data.projects || [];
  const departments = data.departments || [];
  const personById = new Map(people.map((p) => [p.id, p]));
  const projectName = (id) => projects.find((p) => p.id === id)?.name;
  const departmentName = (id) => departments.find((d) => d.id === id)?.name;
  const names = (ids, lookup) => (Array.isArray(ids) ? ids : []).map(lookup).filter(Boolean).join('; ');

  const about = [
    ['MagnaFlow workspace export'],
    ['Organisation', meta.organisation || ''],
    ['Exported', (meta.now || new Date()).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'],
    ['Exported by', meta.exportedBy || ''],
    ['Tasks', (data.tasks || []).length],
    ['People', people.length],
    ['Projects', projects.length],
    ['Departments', departments.length],
  ];
  if (meta.tasksTruncated) {
    about.push([]);
    about.push(['Note', 'The task list reached its read limit, so this export holds the most recent tasks only. Export tasks per project from Task Management for the rest.']);
  }

  return [
    { name: 'About', rows: about },
    {
      name: 'Tasks',
      rows: tasksToRows(data.tasks || [], {
        person: (uid) => personById.get(uid),
        projectName,
        departmentName,
      }),
    },
    {
      name: 'People',
      rows: [
        ['Name', 'Email', 'Role', 'Designation', 'Departments', 'Projects', 'Status', 'Phone', 'Added'],
        ...people.map((p) => [
          p.name || '',
          p.email || '',
          roleLabel(p.role),
          p.designation || '',
          names(p.departmentIds, departmentName),
          names(p.projectIds, projectName),
          p.status === 'inactive' ? 'Deactivated' : 'Active',
          p.phone || '',
          day(p.createdAt),
        ]),
      ],
    },
    {
      name: 'Projects',
      rows: [
        ['Name', 'Department', 'Status', 'Created'],
        ...projects.map((p) => [p.name || '', departmentName(p.departmentId) || '', p.status || 'active', day(p.createdAt)]),
      ],
    },
    {
      name: 'Departments',
      rows: [['Name', 'Created'], ...departments.map((d) => [d.name || '', day(d.createdAt)])],
    },
    {
      name: 'Designations',
      rows: [['Name', 'Description'], ...(data.designations || []).map((d) => [d.name || '', d.description || ''])],
    },
  ];
};

/** Write the sheets to an .xlsx file and offer it as a download. */
export const downloadWorkbook = async (sheets, filename) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MagnaFlow';
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name);
    sheet.rows.forEach((row) => ws.addRow(row));
    if (sheet.name !== 'About' && sheet.rows.length > 0) {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
    ws.columns.forEach((col) => {
      let width = 10;
      col.eachCell({ includeEmpty: false }, (cell) => {
        width = Math.max(width, Math.min(60, String(cell.value ?? '').length + 2));
      });
      col.width = width;
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
};
