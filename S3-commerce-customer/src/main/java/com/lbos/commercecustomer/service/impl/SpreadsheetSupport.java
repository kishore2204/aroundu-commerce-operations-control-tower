package com.lbos.commercecustomer.service.impl;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Minimal, dependency-free reader for .csv / .xlsx and writer for .xlsx - just what the retailer
 * bulk product upload needs (plain text/number cells, one header row, a red highlight style).
 * An .xlsx is a zip of XML parts, so this uses only the JDK. The XML parser has DTDs and external
 * entities disabled, and the amount of data read from a file is capped, so a hostile upload can't
 * exhaust memory or read local files.
 */
final class SpreadsheetSupport {

    /** One non-blank row: its 1-based position in the file and its cells by column. */
    record SheetRow(int number, List<String> cells) {
    }

    /** Thrown for anything that means "this file can't be read" - the message is safe to show. */
    static final class UnreadableSpreadsheetException extends Exception {
        UnreadableSpreadsheetException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    static final int STYLE_NORMAL = 0;
    static final int STYLE_HEADER = 1;
    /** Red fill + dark red bold text - a cell whose value caused the rejection. */
    static final int STYLE_ERROR_CELL = 2;
    /** Dark red bold text, no fill - the Error column. */
    static final int STYLE_ERROR_TEXT = 3;

    record WriteCell(String value, int style) {
    }

    /**
     * A data-entry rule for a range of cells. With a {@code listName} the cells only accept the values of that workbook
     * name (a real dropdown); without one it only shows the small "input message" when a cell is selected. {@code range}
     * is a cell range such as "C2:C501". Titles are limited to 32 and messages to 255 characters by the file format.
     */
    record DataValidation(String range, String listName, String promptTitle, String prompt, String errorTitle, String error) {
    }

    /**
     * @param hidden       a supporting sheet (e.g. the lists behind a dropdown) that is not shown as a tab
     * @param freezeHeader keep the first row visible while scrolling
     */
    record WriteSheet(String name, List<Integer> columnWidths, List<List<WriteCell>> rows, boolean hidden, boolean freezeHeader,
            List<DataValidation> validations) {
        WriteSheet(String name, List<Integer> columnWidths, List<List<WriteCell>> rows) {
            this(name, columnWidths, rows, false, false, List.of());
        }
    }

    private static final long MAX_UNCOMPRESSED_BYTES = 30L * 1024 * 1024;
    private static final String MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static final String REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    private SpreadsheetSupport() {
    }

    // ------------------------------------------------------------------------------ reading

    static boolean looksLikeXlsx(byte[] data) {
        return data.length > 3 && data[0] == 'P' && data[1] == 'K';
    }

    /** Reads at most {@code limit} non-blank rows (so an enormous sheet is never fully loaded). */
    static List<SheetRow> readXlsx(byte[] data, int limit) throws UnreadableSpreadsheetException {
        try {
            Map<String, byte[]> parts = readZipParts(data);
            byte[] workbook = parts.get("xl/workbook.xml");
            if (workbook == null) {
                throw new UnreadableSpreadsheetException("The file is not a valid Excel workbook.", null);
            }
            String sheetPath = firstSheetPath(workbook, parts.get("xl/_rels/workbook.xml.rels"));
            byte[] sheet = parts.get(sheetPath);
            if (sheet == null) {
                sheet = parts.get("xl/worksheets/sheet1.xml");
            }
            if (sheet == null) {
                throw new UnreadableSpreadsheetException("The workbook has no readable sheet.", null);
            }
            List<String> shared = parts.containsKey("xl/sharedStrings.xml")
                    ? readSharedStrings(parts.get("xl/sharedStrings.xml")) : List.of();
            return readSheet(sheet, shared, limit);
        } catch (IOException | XMLStreamException | RuntimeException failure) {
            throw new UnreadableSpreadsheetException("The Excel file could not be read. It may be corrupt.", failure);
        }
    }

    private static Map<String, byte[]> readZipParts(byte[] data) throws IOException {
        Map<String, byte[]> parts = new HashMap<>();
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(data))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                boolean needed = name.equals("xl/workbook.xml") || name.equals("xl/_rels/workbook.xml.rels")
                        || name.equals("xl/sharedStrings.xml") || name.startsWith("xl/worksheets/sheet");
                if (!needed) {
                    continue;
                }
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int read;
                while ((read = zip.read(buffer)) > 0) {
                    total += read;
                    if (total > MAX_UNCOMPRESSED_BYTES) {
                        throw new IOException("Spreadsheet is too large");
                    }
                    out.write(buffer, 0, read);
                }
                parts.put(name, out.toByteArray());
            }
        }
        return parts;
    }

    private static XMLStreamReader xml(byte[] bytes) throws XMLStreamException {
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        return factory.createXMLStreamReader(new ByteArrayInputStream(bytes));
    }

    /** The first sheet in workbook order, resolved through the workbook relationships. */
    private static String firstSheetPath(byte[] workbook, byte[] rels) throws XMLStreamException {
        String relationshipId = null;
        XMLStreamReader reader = xml(workbook);
        while (reader.hasNext()) {
            if (reader.next() == XMLStreamConstants.START_ELEMENT && reader.getLocalName().equals("sheet")) {
                relationshipId = reader.getAttributeValue(REL_NS, "id");
                break;
            }
        }
        if (relationshipId != null && rels != null) {
            XMLStreamReader relReader = xml(rels);
            while (relReader.hasNext()) {
                if (relReader.next() == XMLStreamConstants.START_ELEMENT
                        && relReader.getLocalName().equals("Relationship")
                        && relationshipId.equals(relReader.getAttributeValue(null, "Id"))) {
                    String target = relReader.getAttributeValue(null, "Target");
                    if (target != null) {
                        return target.startsWith("/") ? target.substring(1) : "xl/" + target;
                    }
                }
            }
        }
        return "xl/worksheets/sheet1.xml";
    }

    private static List<String> readSharedStrings(byte[] bytes) throws XMLStreamException {
        List<String> strings = new ArrayList<>();
        XMLStreamReader reader = xml(bytes);
        StringBuilder current = null;
        boolean inText = false;
        int phoneticDepth = 0;
        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                String name = reader.getLocalName();
                if (name.equals("si")) {
                    current = new StringBuilder();
                } else if (name.equals("rPh")) {
                    phoneticDepth++;
                } else if (name.equals("t") && current != null && phoneticDepth == 0) {
                    inText = true;
                }
            } else if (event == XMLStreamConstants.CHARACTERS || event == XMLStreamConstants.CDATA) {
                if (inText) {
                    current.append(reader.getText());
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                String name = reader.getLocalName();
                if (name.equals("t")) {
                    inText = false;
                } else if (name.equals("rPh")) {
                    phoneticDepth--;
                } else if (name.equals("si") && current != null) {
                    strings.add(current.toString());
                    current = null;
                }
            }
        }
        return strings;
    }

    private static List<SheetRow> readSheet(byte[] bytes, List<String> shared, int limit) throws XMLStreamException {
        List<SheetRow> rows = new ArrayList<>();
        XMLStreamReader reader = xml(bytes);
        int rowNumber = 0;
        List<String> cells = null;
        String cellType = null;
        int column = -1;
        StringBuilder value = null;
        boolean inValue = false;
        boolean inInlineText = false;
        while (reader.hasNext()) {
            int event = reader.next();
            if (event == XMLStreamConstants.START_ELEMENT) {
                switch (reader.getLocalName()) {
                    case "row" -> {
                        String reference = reader.getAttributeValue(null, "r");
                        rowNumber = reference != null ? Integer.parseInt(reference) : rowNumber + 1;
                        cells = new ArrayList<>();
                    }
                    case "c" -> {
                        cellType = reader.getAttributeValue(null, "t");
                        String reference = reader.getAttributeValue(null, "r");
                        column = reference != null ? columnIndex(reference) : column + 1;
                        value = new StringBuilder();
                    }
                    case "v" -> inValue = true;
                    case "t" -> inInlineText = value != null;
                    default -> {
                    }
                }
            } else if (event == XMLStreamConstants.CHARACTERS || event == XMLStreamConstants.CDATA) {
                if ((inValue || inInlineText) && value != null) {
                    value.append(reader.getText());
                }
            } else if (event == XMLStreamConstants.END_ELEMENT) {
                switch (reader.getLocalName()) {
                    case "v" -> inValue = false;
                    case "t" -> inInlineText = false;
                    case "c" -> {
                        if (cells != null && column >= 0 && value != null) {
                            while (cells.size() <= column) {
                                cells.add("");
                            }
                            cells.set(column, cellText(cellType, value.toString(), shared));
                        }
                        value = null;
                    }
                    case "row" -> {
                        if (cells != null && cells.stream().anyMatch(cell -> !cell.isBlank())) {
                            rows.add(new SheetRow(rowNumber, cells));
                            if (rows.size() >= limit) {
                                return rows;
                            }
                        }
                        cells = null;
                    }
                    default -> {
                    }
                }
            }
        }
        return rows;
    }

    private static String cellText(String type, String raw, List<String> shared) {
        if ("s".equals(type)) {
            int index = Integer.parseInt(raw.trim());
            return index >= 0 && index < shared.size() ? shared.get(index) : "";
        }
        if ("b".equals(type)) {
            return "1".equals(raw.trim()) ? "TRUE" : "FALSE";
        }
        return raw;
    }

    private static int columnIndex(String reference) {
        int index = 0;
        for (int i = 0; i < reference.length(); i++) {
            char ch = reference.charAt(i);
            if (!Character.isLetter(ch)) {
                break;
            }
            index = index * 26 + (Character.toUpperCase(ch) - 'A' + 1);
        }
        return index - 1;
    }

    /** RFC 4180 style: quoted fields, doubled quotes, CRLF/LF, optional UTF-8 BOM; comma, semicolon or tab. */
    static List<SheetRow> readCsv(byte[] data, int limit) {
        String text = new String(data, StandardCharsets.UTF_8);
        if (text.startsWith("﻿")) {
            text = text.substring(1);
        }
        int firstLineEnd = text.indexOf('\n');
        String firstLine = firstLineEnd < 0 ? text : text.substring(0, firstLineEnd);
        char delimiter = ',';
        int best = count(firstLine, ',');
        if (count(firstLine, ';') > best) {
            delimiter = ';';
            best = count(firstLine, ';');
        }
        if (count(firstLine, '\t') > best) {
            delimiter = '\t';
        }

        List<SheetRow> rows = new ArrayList<>();
        List<String> cells = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        int line = 1;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field.append(ch);
                }
            } else if (ch == '"' && field.length() == 0) {
                quoted = true;
            } else if (ch == delimiter) {
                cells.add(field.toString());
                field.setLength(0);
            } else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') {
                    i++;
                }
                cells.add(field.toString());
                field.setLength(0);
                if (cells.stream().anyMatch(cell -> !cell.isBlank())) {
                    rows.add(new SheetRow(line, cells));
                    if (rows.size() >= limit) {
                        return rows;
                    }
                }
                cells = new ArrayList<>();
                line++;
            } else {
                field.append(ch);
            }
        }
        cells.add(field.toString());
        if (cells.stream().anyMatch(cell -> !cell.isBlank())) {
            rows.add(new SheetRow(line, cells));
        }
        return rows;
    }

    private static int count(String text, char ch) {
        int total = 0;
        for (int i = 0; i < text.length(); i++) {
            if (text.charAt(i) == ch) {
                total++;
            }
        }
        return total;
    }

    // ------------------------------------------------------------------------------ writing

    static byte[] writeXlsx(List<WriteSheet> sheets) {
        return writeXlsx(sheets, Map.of());
    }

    /** @param definedNames workbook-level names (name -> reference such as {@code Lists!$A$2:$A$9}) that data validations point at */
    static byte[] writeXlsx(List<WriteSheet> sheets, Map<String, String> definedNames) {
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(bytes)) {
            StringBuilder contentTypes = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                    + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                    + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                    + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                    + "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>"
                    + "<Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>");
            StringBuilder workbookSheets = new StringBuilder();
            StringBuilder workbookRels = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                    + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
            for (int i = 0; i < sheets.size(); i++) {
                int number = i + 1;
                contentTypes.append("<Override PartName=\"/xl/worksheets/sheet").append(number)
                        .append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
                workbookSheets.append("<sheet name=\"").append(escape(sheets.get(i).name())).append("\" sheetId=\"")
                        .append(number).append(sheets.get(i).hidden() ? "\" state=\"hidden" : "").append("\" r:id=\"rId").append(number).append("\"/>");
                workbookRels.append("<Relationship Id=\"rId").append(number)
                        .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet")
                        .append(number).append(".xml\"/>");
            }
            contentTypes.append("</Types>");
            workbookRels.append("<Relationship Id=\"rId").append(sheets.size() + 1)
                    .append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>");

            putEntry(zip, "[Content_Types].xml", contentTypes.toString());
            putEntry(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                    + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                    + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            StringBuilder names = new StringBuilder();
            if (!definedNames.isEmpty()) {
                names.append("<definedNames>");
                definedNames.forEach((name, reference) -> names.append("<definedName name=\"").append(escape(name)).append("\">")
                        .append(escape(reference)).append("</definedName>"));
                names.append("</definedNames>");
            }
            putEntry(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                    + "<workbook xmlns=\"" + MAIN_NS + "\" xmlns:r=\"" + REL_NS + "\"><sheets>" + workbookSheets + "</sheets>" + names + "</workbook>");
            putEntry(zip, "xl/_rels/workbook.xml.rels", workbookRels.toString());
            putEntry(zip, "xl/styles.xml", STYLES_XML);
            for (int i = 0; i < sheets.size(); i++) {
                putEntry(zip, "xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(sheets.get(i)));
            }
            zip.finish();
            return bytes.toByteArray();
        } catch (IOException impossible) {
            throw new IllegalStateException("Could not build the spreadsheet", impossible);
        }
    }

    private static final String STYLES_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
            + "<styleSheet xmlns=\"" + MAIN_NS + "\">"
            + "<fonts count=\"3\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font>"
            + "<font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font>"
            + "<font><b/><sz val=\"11\"/><color rgb=\"FF9C0006\"/><name val=\"Calibri\"/></font></fonts>"
            + "<fills count=\"4\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill>"
            + "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE7E6E6\"/><bgColor indexed=\"64\"/></patternFill></fill>"
            + "<fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFFFC7CE\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>"
            + "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>"
            + "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>"
            + "<cellXfs count=\"4\">"
            + "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>"
            + "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"2\" fillId=\"3\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\"/>"
            + "<xf numFmtId=\"0\" fontId=\"2\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyFont=\"1\"/>"
            + "</cellXfs><cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>";

    private static String sheetXml(WriteSheet sheet) {
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"")
                .append(MAIN_NS).append("\">");
        if (sheet.freezeHeader()) {
            xml.append("<sheetViews><sheetView workbookViewId=\"0\"><pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>"
                    + "<selection pane=\"bottomLeft\"/></sheetView></sheetViews>");
        }
        if (!sheet.columnWidths().isEmpty()) {
            xml.append("<cols>");
            for (int i = 0; i < sheet.columnWidths().size(); i++) {
                xml.append("<col min=\"").append(i + 1).append("\" max=\"").append(i + 1).append("\" width=\"")
                        .append(sheet.columnWidths().get(i)).append("\" customWidth=\"1\"/>");
            }
            xml.append("</cols>");
        }
        xml.append("<sheetData>");
        for (int r = 0; r < sheet.rows().size(); r++) {
            xml.append("<row r=\"").append(r + 1).append("\">");
            List<WriteCell> row = sheet.rows().get(r);
            for (int c = 0; c < row.size(); c++) {
                WriteCell cell = row.get(c);
                if (cell == null || cell.value() == null || cell.value().isEmpty()) {
                    if (cell != null && cell.style() != STYLE_NORMAL) {
                        xml.append("<c r=\"").append(columnName(c)).append(r + 1).append("\" s=\"").append(cell.style()).append("\"/>");
                    }
                    continue;
                }
                xml.append("<c r=\"").append(columnName(c)).append(r + 1).append("\" t=\"inlineStr\" s=\"")
                        .append(cell.style()).append("\"><is><t xml:space=\"preserve\">")
                        .append(escape(cell.value())).append("</t></is></c>");
            }
            xml.append("</row>");
        }
        xml.append("</sheetData>");
        if (!sheet.validations().isEmpty()) {
            xml.append("<dataValidations count=\"").append(sheet.validations().size()).append("\">");
            for (DataValidation validation : sheet.validations()) {
                boolean list = validation.listName() != null;
                xml.append("<dataValidation");
                if (list) {
                    xml.append(" type=\"list\" allowBlank=\"1\" showErrorMessage=\"1\" errorStyle=\"stop\" errorTitle=\"")
                            .append(escape(limit(validation.errorTitle(), 32))).append("\" error=\"")
                            .append(escape(limit(validation.error(), 255))).append("\"");
                } else {
                    xml.append(" allowBlank=\"1\"");
                }
                xml.append(" showInputMessage=\"1\" promptTitle=\"").append(escape(limit(validation.promptTitle(), 32)))
                        .append("\" prompt=\"").append(escape(limit(validation.prompt(), 255))).append("\" sqref=\"")
                        .append(escape(validation.range())).append("\">");
                if (list) {
                    xml.append("<formula1>").append(escape(validation.listName())).append("</formula1>");
                }
                xml.append("</dataValidation>");
            }
            xml.append("</dataValidations>");
        }
        return xml.append("</worksheet>").toString();
    }

    private static String limit(String text, int max) {
        String value = text == null ? "" : text;
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
    }

    /** Spreadsheet column letters for a 0-based index: 0 -> A, 25 -> Z, 26 -> AA. */
    static String columnName(int index) {
        StringBuilder name = new StringBuilder();
        for (int n = index + 1; n > 0; n = (n - 1) / 26) {
            name.insert(0, (char) ('A' + (n - 1) % 26));
        }
        return name.toString();
    }

    private static void putEntry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    /** XML-escapes and drops characters XML 1.0 cannot represent. */
    private static String escape(String text) {
        StringBuilder out = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            switch (ch) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                default -> {
                    if (ch == '\t' || ch == '\n' || ch == '\r' || ch >= 0x20) {
                        out.append(ch);
                    }
                }
            }
        }
        return out.toString();
    }
}
