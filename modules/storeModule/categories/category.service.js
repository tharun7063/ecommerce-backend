const { where } = require('sequelize');
const db = require('../../../db');
const { attempt } = require('joi');


module.exports = {
    addCategory,
    getAllCategory,
    getCategoryByUid,
    updateCategory,
    deleteCategory
}



// async function addCategory(req) {
//     try {

//         const { name, description, parent_id } = req.body;

//         const userUid = req.user.uid;

//         if (parent_id) {
//             const parentCategory = await db.Category.findByPk(parent_id);
//             if (!parentCategory) {
//                 return {
//                     success: false,
//                     message: "Parent category not found."
//                 };
//             }
//         }

//         const category = await db.Category.create({
//             name,
//             description,
//             parent_id: parent_id || null,
//             created_by: userUid,
//             updated_by: userUid
//         });

//         return {
//             success: true,
//             message: 'Category created successfully.',
//             data: category
//         };

//     } catch (error) {
//         console.error("Error creating category:", error);
//         return {
//             success: false,
//             message: "Internal server error",
//             error: error.message
//         };
//     }
// }

async function addCategory(req) {
    try {
        const payload = Array.isArray(req.body) ? req.body : [req.body];
        const userUid = req.user.uid;

        // Validate parent categories
        for (const item of payload) {
            if (item.parent_id) {
                const parentCategory = await db.Category.findByPk(item.parent_id);
                if (!parentCategory) {
                    return {
                        success: false,
                        message: `Parent category not found for "${item.name}".`
                    };
                }
            }
        }

        // Prepare categories
        const categoriesToCreate = payload.map(item => ({
            name: item.name,
            description: item.description,
            parent_id: item.parent_id || null,
            created_by: userUid,
            updated_by: userUid
        }));

        let createdCategories;
        if (categoriesToCreate.length === 1) {
            createdCategories = await db.Category.create(categoriesToCreate[0]);
        } else {
            createdCategories = await db.Category.bulkCreate(categoriesToCreate);
        }

        return {
            success: true,
            message: categoriesToCreate.length > 1
                ? "Categories created successfully."
                : "Category created successfully.",
            data: createdCategories
        };

    } catch (error) {
        console.error("Error creating category:", error);
        return {
            success: false,
            message: "Internal server error",
            error: error.message
        };
    }
}

async function getAllCategory() {
    try {
        // const categories = await db.Category.findAll();
        const categories = await db.Category.findAll({
            attributes: ["id", "uid", "name", "description", "parent_id"],
            order: [["id", "ASC"]],
            include: [
                {
                    model: db.Category,
                    as: "parent",
                    attributes: ["id", "uid", "name"]
                }
            ]
        });
        return {
            success: true,
            message: 'Categories fetched successfully',
            data: categories
        }
    } catch { }
}

async function getCategoryByUid(req, res) {
    try {
        const { uid } = req.params;

        const category = await db.Category.findOne({
            where: { uid },
            attributes: ['id', 'uid', 'name', 'description', 'parent_id'],
            include: [
                {
                    model: db.Category,
                    as: 'parent',
                    attributes: ['id', 'uid', 'name']
                }
            ]
        });

        if (!category) {
            return {
                success: false,
                message: "Category not found"
            };
        }

        return {
            success: true,
            message: "Category fetched successfully",
            data: category
        };

    } catch (error) {
        console.error("Error fetching category by UID:", error);
        return {
            success: false,
            message: "Internal server error",
            error: error.message
        };
    }
}

async function updateCategory(req) {
    try {
        const { uid } = req.params;
        const { name, description, parent_id } = req.body;

        const category = await db.Category.findOne({ where: { uid } });
        if (!category) {
            return { success: false, message: "Category not found" };
        }

        if (parent_id !== undefined && parent_id !== null) {
            const parentCategory = await db.Category.findByPk(parent_id);
            if (!parentCategory) {
                return { success: false, message: "Parent category not found" };
            }
            if (parentCategory.id === category.id) {
                return { success: false, message: "Category cannot be its own parent" };
            }
        }

        const updatedData = {};
        if (name !== undefined) updatedData.name = name;
        if (description !== undefined) updatedData.description = description;
        if (parent_id !== undefined) updatedData.parent_id = parent_id;

        if (req.user && req.user.uid) {
            updatedData.updated_by = req.user.uid;
        }

        await category.update(updatedData);

        return { success: true, message: "Category updated", data: category };
    } catch (error) {
        console.error("Error updating category:", error);
        return {
            success: false,
            message: "Internal server error",
            error: error.message
        };
    }
}

async function deleteCategory(req) {
    try {
        const { uid } = req.params;

        const category = await db.Category.findOne({ where: { uid } });
        if (!category) {
            return { success: false, message: "Category not found" };
        }

        async function deleteChildren(parentId) {
            const children = await db.Category.findAll({ where: { parent_id: parentId } });
            for (const child of children) {
                await deleteChildren(child.id);
                await child.destroy();
            }
        }

        await deleteChildren(category.id);
        await category.destroy();

        return { success: true, message: "Category and all its child categories deleted successfully" };
    } catch (error) {
        console.error("Error deleting category:", error);
        return {
            success: false,
            message: "Internal server error",
            error: error.message
        };
    }
}


