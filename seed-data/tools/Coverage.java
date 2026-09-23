import java.sql.*;
import java.util.*;

/**
 * Prints, for every column of every table of the seeded database, how many rows exist and how many are populated.
 * Used to produce seed-data/ENTITY_FIELD_COVERAGE.md.
 *
 *   java -cp <jdbc driver jar> seed-data/tools/Coverage.java <jdbc-url> <user> <password>
 */
public class Coverage {
    public static void main(String[] args) throws Exception {
        try (Connection c = DriverManager.getConnection(args[0], args[1], args.length > 2 ? args[2] : "")) {
            List<String> tables = new ArrayList<>();
            try (ResultSet rs = c.getMetaData().getTables(null, null, "%", new String[] {"TABLE"})) {
                while (rs.next()) {
                    String schema = rs.getString("TABLE_SCHEM");
                    if (schema != null && (schema.equalsIgnoreCase("INFORMATION_SCHEMA") || schema.equalsIgnoreCase("pg_catalog"))) continue;
                    tables.add(rs.getString("TABLE_NAME"));
                }
            }
            Collections.sort(tables);
            for (String table : tables) {
                long rows;
                try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("select count(*) from " + table)) {
                    rs.next();
                    rows = rs.getLong(1);
                }
                try (ResultSet cols = c.getMetaData().getColumns(null, null, table, "%")) {
                    while (cols.next()) {
                        String column = cols.getString("COLUMN_NAME");
                        String type = cols.getString("TYPE_NAME");
                        int size = cols.getInt("COLUMN_SIZE");
                        boolean nullable = "YES".equals(cols.getString("IS_NULLABLE"));
                        long populated;
                        String example = "";
                        try (Statement st = c.createStatement();
                             ResultSet rs = st.executeQuery("select count(" + column + ") from " + table)) {
                            rs.next();
                            populated = rs.getLong(1);
                        }
                        if (populated > 0) {
                            try (Statement st = c.createStatement();
                                 ResultSet rs = st.executeQuery("select " + column + " from " + table + " where " + column + " is not null limit 1")) {
                                if (rs.next()) {
                                    Object v = rs.getObject(1);
                                    example = v instanceof byte[] b ? "(" + b.length + " bytes)" : String.valueOf(v);
                                }
                            }
                        }
                        System.out.println(String.join("\t", table, column, type + (size > 0 && size < 100000 && !type.equalsIgnoreCase("UUID") ? "(" + size + ")" : ""),
                                nullable ? "NULL" : "NOT NULL", String.valueOf(rows), String.valueOf(populated), example.replace('\t', ' ').replace('\n', ' ')));
                    }
                }
            }
        }
    }
}
