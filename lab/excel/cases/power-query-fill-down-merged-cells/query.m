let S=Excel.Workbook(File.Contents("{{INPUT_XLSX}}"),null,true), D=S{[Item="Input",Kind="Sheet"]}[Data] in Table.PromoteHeaders(D,[PromoteAllScalars=true])
