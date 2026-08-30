//! Reading the declared DDL: its statements, its tables, and each table's columns.

pub(crate) struct Table {
    pub name: String,
    pub columns: Vec<Column>,
}

pub(crate) struct Column {
    pub name: String,
    pub definition: String,
}

/// Every statement in `ddl`, comments stripped and whitespace collapsed.
pub(crate) fn statements(ddl: &str) -> Vec<String> {
    without_comments(ddl)
        .split(';')
        .map(collapse_whitespace)
        .filter(|s| !s.is_empty())
        .collect()
}

/// Every table `ddl` declares, in the order it declares them.
pub(crate) fn tables(ddl: &str) -> Vec<Table> {
    statements(ddl).iter().filter_map(|s| table(s)).collect()
}

/// The table `statement` declares, or `None` if it declares something else.
pub(crate) fn table(statement: &str) -> Option<Table> {
    let rest = strip_ci(statement, "CREATE TABLE ")?;
    let rest = strip_ci(rest, "IF NOT EXISTS ").unwrap_or(rest);
    let open = rest.find('(')?;
    let close = rest.rfind(')')?;
    Some(Table {
        name: identifier(&rest[..open]),
        columns: parts(&rest[open + 1..close])
            .into_iter()
            .filter_map(column)
            .collect(),
    })
}

fn column(part: String) -> Option<Column> {
    const CONSTRAINTS: &[&str] = &["PRIMARY", "UNIQUE", "FOREIGN", "CHECK", "CONSTRAINT"];
    let head = part.split([' ', '(']).next()?;
    if CONSTRAINTS.iter().any(|c| head.eq_ignore_ascii_case(c)) {
        return None;
    }
    Some(Column {
        name: identifier(head),
        definition: part,
    })
}

// Depth- and quote-aware, so a `PRIMARY KEY (a, b)` or a quoted default holding
// a comma stays one part.
fn parts(body: &str) -> Vec<String> {
    let (mut out, mut current, mut depth, mut quoted) = (Vec::new(), String::new(), 0usize, false);
    for ch in body.chars() {
        match ch {
            '\'' => quoted = !quoted,
            '(' if !quoted => depth += 1,
            ')' if !quoted => depth = depth.saturating_sub(1),
            ',' if !quoted && depth == 0 => {
                out.push(std::mem::take(&mut current).trim().to_string());
                continue;
            }
            _ => {}
        }
        current.push(ch);
    }
    let last = current.trim();
    if !last.is_empty() {
        out.push(last.to_string());
    }
    out
}

pub(crate) fn identifier(raw: &str) -> String {
    raw.trim().trim_matches('"').to_ascii_lowercase()
}

fn without_comments(sql: &str) -> String {
    sql.lines()
        .map(|line| line.split("--").next().unwrap_or_default())
        .collect::<Vec<_>>()
        .join("\n")
}

fn collapse_whitespace(statement: &str) -> String {
    statement.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_ci<'a>(sql: &'a str, prefix: &str) -> Option<&'a str> {
    let head = sql.get(..prefix.len())?;
    head.eq_ignore_ascii_case(prefix)
        .then(|| sql[prefix.len()..].trim_start())
}

#[cfg(test)]
mod tests {
    use super::*;

    const DDL: &str = "
        -- a comment holding a ; and a , to be ignored
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
            permissions TEXT NOT NULL DEFAULT '[\"playback\"]',
            PRIMARY KEY (id, email)
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    ";

    #[test]
    fn a_table_yields_its_columns_and_not_its_table_constraints() {
        let tables = tables(DDL);

        assert_eq!(tables.len(), 1);
        assert_eq!(tables[0].name, "users");
        let names: Vec<&str> = tables[0].columns.iter().map(|c| c.name.as_str()).collect();
        assert_eq!(names, ["id", "email", "permissions"]);
    }

    #[test]
    fn a_column_keeps_the_whole_definition_an_alter_would_need() {
        let tables = tables(DDL);

        let permissions = &tables[0].columns[2];
        assert_eq!(
            permissions.definition,
            "permissions TEXT NOT NULL DEFAULT '[\"playback\"]'"
        );
    }

    #[test]
    fn an_index_is_a_statement_but_never_a_table() {
        let statements = statements(DDL);

        assert_eq!(statements.len(), 2);
        assert!(table(&statements[0]).is_some());
        assert!(table(&statements[1]).is_none());
    }
}
